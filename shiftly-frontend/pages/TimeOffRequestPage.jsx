// src/pages/TimeOffRequestPage.jsx

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import RangeCalendar from '../components/RangeCalendar';
import { submitEmployeeRequest } from '../utils/requestHandler';

// 🛡️ Content Safety REST client
import ContentSafetyClient, { isUnexpected } from '@azure-rest/ai-content-safety';
import { AzureKeyCredential } from '@azure/core-auth';

const safetyClient = ContentSafetyClient(
  import.meta.env.VITE_CONTENT_SAFETY_ENDPOINT.replace(/\/$/, ''),
  new AzureKeyCredential(import.meta.env.VITE_CONTENT_SAFETY_KEY)
);

export default function TimeOffRequestPage() {
  const { user } = useAuth();
  const [range, setRange]     = useState({ start: null, end: null });
  const [reason, setReason]   = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const openErrorModal = msg => {
    setMessage(msg);
    setShowErrorModal(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);

    const { start, end } = range;
    if (!start || !end || !reason.trim()) {
      openErrorModal('Please fill in all fields.');
      setLoading(false);
      return;
    }
    if (end < start) {
      openErrorModal('End date cannot be before start date.');
      setLoading(false);
      return;
    }

    try {
      // 1️⃣ Run Content Safety analysis
      const analyzeResponse = await safetyClient
        .path('/text:analyze', '2024-09-01')
        .post({ body: { text: reason } });

      if (isUnexpected(analyzeResponse)) {
        console.error('Content Safety error:', analyzeResponse);
        openErrorModal('Failed to classify your reason. Please try again.');
        setLoading(false);
        return;
      }

      const categories = analyzeResponse.body.categoriesAnalysis;
      const violation = categories.some(cat => {
        const sev = typeof cat.severity === 'string' ? parseInt(cat.severity, 10) : cat.severity;
        return sev >= 4; // Medium or High
      });

      if (violation) {
        openErrorModal(
          'Your reason contains content that violates our policy. Please rephrase and try again.'
        );
        setLoading(false);
        return;
      }

      // 2️⃣ Lookup employee_id
      const { data: empData, error: empError } = await supabase
        .from('employee')
        .select('employee_id')
        .eq('email', user.email)
        .single();

      if (empError || !empData) {
        openErrorModal('Could not find your employee record.');
        setLoading(false);
        return;
      }
      const employeeId = empData.employee_id;

      // 3️⃣ Submit the time-off request
      const payload = {
        employee_id:  employeeId,
        request_type: 'time-off',
        request: {
          start_date: start.toISOString().split('T')[0],
          end_date:   end.toISOString().split('T')[0],
          reason
        }
      };

      // Use the imported submitEmployeeRequest utility to submit the request
      const result = await submitEmployeeRequest(requestPayload);

      if (result && result.error) {
        setMessage('Failed to submit request: ' + result.error);
      } else {
        openErrorModal('Your time-off request has been submitted for approval!');
        setRange({ start: null, end: null });
        setReason('');
      }
    } catch (err) {
      console.error('Submission error:', err);
      openErrorModal('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <>
      {/* ERROR / INFO MODAL */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
            <p className="mb-4 text-gray-800">{message}</p>
            <button
              onClick={() => setShowErrorModal(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row max-w-4xl mx-auto p-4 sm:p-6 md:p-0 mt-4 sm:mt-6 md:mt-10 bg-white rounded-lg shadow overflow-hidden">
        {/* Calendar Panel */}
        <div className="md:w-1/2 w-full bg-gray-50 p-4 sm:p-6 md:p-8 border-b md:border-b-0 md:border-r">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-center">Select Date Range</h3>
          <RangeCalendar
            selectedRange={range}
            onRangeSelect={setRange}
            onDateClick={handleDateClick}
          />
          <button
            type="button"
            className="mt-4 px-3 py-1 rounded text-xs font-semibold border bg-gray-200"
            onClick={() => setRange({ start: null, end: null })}
          >
            Clear Selection
          </button>
        </div>

        {/* Form Panel */}
        <div className="md:w-1/2 w-full p-6 flex flex-col justify-center">
          <h2 className="text-2xl font-bold mb-4 text-center">Request Time Off</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-1">Start Date</label>
              <input
                type="text"
                value={range.start ? range.start.toLocaleDateString() : ''}
                readOnly
                className="w-full border rounded px-3 py-2 bg-gray-100"
                required
              />
            </div>
            <div>
              <label className="block mb-1">End Date</label>
              <input
                type="text"
                value={range.end ? range.end.toLocaleDateString() : ''}
                readOnly
                className="w-full border rounded px-3 py-2 bg-gray-100"
                required
              />
            </div>
            <div>
              <label className="block mb-1">Reason</label>
              <textarea
                className="w-full border rounded px-3 py-2"
                value={reason}
                onChange={e => {
                  const alphaCount = (e.target.value.match(/[a-zA-Z]/g) || []).length;
                  if (alphaCount <= 500) setReason(e.target.value);
                }}
                rows={3}
                maxLength={2000}
                required
              />
              <div className="text-xs text-gray-500 text-right">
                {(reason.match(/[a-zA-Z]/g) || []).length} / 500 letters
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Submitting…' : 'Submit Request'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
