import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import RangeCalendar from '../components/RangeCalendar';
import { submitEmployeeRequest } from '../utils/requestHandler';

const TimeOffRequestPage = () => {
  const { user } = useAuth();
  const [range, setRange] = useState({ start: null, end: null });
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const { start, end } = range;

    if (!start || !end || !reason) {
      setMessage('Please fill in all fields.');
      setLoading(false);
      return;
    }

    if (end < start) {
      setMessage('End date cannot be before start date.');
      setLoading(false);
      return;
    }

    try {
      // Look up the integer employee_id for this user by email (as in ChangeAvailabity)
      const { data: empData, error: empError } = await supabase
        .from('employee')
        .select('employee_id')
        .eq('email', user.email)
        .single();
      if (empError || !empData) {
        setMessage('Could not find employee record.');
        setLoading(false);
        return;
      }
      const employeeId = empData.employee_id;

      // Submit time-off request for approval
      const requestPayload = {
        employee_id: employeeId,
        request_type: 'time-off',
        request: {
          start_date: start.toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0],
          reason,
        },
      };
      const result = await submitEmployeeRequest(requestPayload);
      if (!result.success) {
        setMessage('Failed to submit request: ' + result.error);
      } else {
        setMessage('Time off request submitted for approval!');
        setRange({ start: null, end: null });
        setReason('');
      }
    } catch (err) {
      setMessage('An error occurred.');
    }

    setLoading(false);
  };

  // Range selection logic: 1st click sets start, 2nd click sets end, 3rd click resets
  const handleDateClick = (date) => {
    if (!range.start || (range.start && range.end)) {
      setRange({ start: date, end: null });
    } else if (range.start && !range.end) {
      if (date < range.start) {
        setRange({ start: date, end: range.start });
      } else {
        setRange({ start: range.start, end: date });
      }
    }
  };

  return (
    <div className="flex flex-col md:flex-row max-w-4xl mx-auto mt-10 bg-white rounded-lg shadow overflow-hidden">
      {/* Calendar on the left */}
      <div className="md:w-1/2 w-full flex flex-col items-center justify-center bg-gray-50 p-8 border-r min-h-[420px]">
        <h3 className="text-lg font-semibold mb-4 text-center">Select Date Range</h3>
        <div className="w-full flex justify-center mb-4">
          <RangeCalendar
            selectedRange={range}
            onRangeSelect={setRange}
          />
        </div>
        <button
          type="button"
          className="px-3 py-1 rounded text-xs font-semibold border bg-gray-200 text-gray-700 mt-2"
          onClick={() => setRange({ start: null, end: null })}
        >
          Clear Selection
        </button>
      </div>

      {/* Form on the right */}
      <div className="md:w-1/2 w-full p-6 flex flex-col justify-center">
        <h2 className="text-2xl font-bold mb-4 text-center">Request Time Off</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-1">Start Date</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              value={range.start ? range.start.toLocaleDateString() : ''}
              readOnly
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">End Date</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              value={range.end ? range.end.toLocaleDateString() : ''}
              readOnly
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Reason</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              value={reason}
              onChange={e => {
                // Only allow up to 500 alphabetic characters
                const alphaCount = (e.target.value.match(/[a-zA-Z]/g) || []).length;
                if (alphaCount <= 500) setReason(e.target.value);
              }}
              required
              rows={3}
              maxLength={2000} // fallback for very long text
            />
            <div className="text-xs text-gray-500 text-right mt-1">
              {(reason.match(/[a-zA-Z]/g) || []).length} / 500 letters
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition"
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
          {message && <div className="text-center mt-2 text-sm text-blue-700">{message}</div>}
        </form>
      </div>
    </div>
  );
};

export default TimeOffRequestPage;
