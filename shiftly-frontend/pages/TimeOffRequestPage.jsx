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
    <div className="flex flex-col md:flex-row max-w-4xl mx-auto p-4 sm:p-6 md:p-0 mt-4 sm:mt-6 md:mt-10 bg-white rounded-lg shadow overflow-hidden">
      {/* Calendar on the left */}
      <div className="md:w-1/2 w-full flex flex-col items-center justify-center bg-gray-50 p-4 sm:p-6 md:p-8 border-b md:border-b-0 md:border-r min-h-[420px]">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-center">Select Date Range</h3>
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
          id="clear-dates"
          name="clear-dates"
          aria-label="Clear date selection"
        >
          Clear Selection
        </button>
      </div>

      {/* Form on the right */}
      <div className="md:w-1/2 w-full p-4 sm:p-6 flex flex-col justify-center">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-center">Request Time Off</h2>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label htmlFor="start-date" className="block text-gray-700 mb-1">Start Date</label>
            <input
              id="start-date"
              name="start-date"
              type="text"
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              value={range.start ? range.start.toLocaleDateString() : ''}
              readOnly
              required
              aria-label="Selected start date"
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-gray-700 mb-1">End Date</label>
            <input
              id="end-date"
              name="end-date"
              type="text"
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              value={range.end ? range.end.toLocaleDateString() : ''}
              readOnly
              required
              aria-label="Selected end date"
            />
          </div>
          <div>
            <label htmlFor="reason" className="block text-gray-700 mb-1">Reason</label>
            <textarea
              id="reason"
              name="reason"
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
              aria-label="Reason for time off request"
            />
            <div className="text-xs text-gray-500 text-right mt-1" id="reason-counter" aria-live="polite">
              {(reason.match(/[a-zA-Z]/g) || []).length} / 500 letters
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition"
            disabled={loading}
            id="submit-request"
            name="submit-request"
            aria-label="Submit time off request"
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
          {message && <div className="text-center mt-2 text-sm text-blue-700" aria-live="polite" role="alert">{message}</div>}
        </form>
      </div>
    </div>
  );
};

export default TimeOffRequestPage;
