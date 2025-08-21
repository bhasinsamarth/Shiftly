import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import RangeCalendar from '../components/RangeCalendar';
import { submitEmployeeRequest } from '../utils/requestHandler';
import InputField from '../components/InputField';

const TimeOffRequestPage = () => {
  const { user } = useAuth();
  const [range, setRange] = useState({ start: null, end: null });
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState(null);

  // Alert modal state (similar to chat implementation)
  const [alertModalMsg, setAlertModalMsg] = useState('');
  const [showAlertModal, setShowAlertModal] = useState(false);
  const openAlertModal = msg => {
    setAlertModalMsg(msg);
    setShowAlertModal(true);
  };

  // Load current employee data
  useEffect(() => {
    if (!user?.email) return;
    (async () => {
      const { data: empData, error } = await supabase
        .from('employee')
        .select('employee_id')
        .eq('email', user.email)
        .single();
      if (empData) {
        setCurrentEmployee(empData);
      }
    })();
  }, [user?.email]);

  // Subscribe to content safety events (same pattern as chat)
  useEffect(() => {
    if (!currentEmployee?.employee_id) return;
    
    const channel = supabase
      .channel(`content_safety_events_timeoff_${currentEmployee.employee_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'content_safety_events',
          filter: `employee_id=eq.${currentEmployee.employee_id}`,
        },
        payload => {
          console.debug('[Moderation Event - TimeOffRequest]', payload);
          if (payload?.new?.reason) {
            openAlertModal(payload.new.reason);
          } else {
            openAlertModal('Your time-off request contains inappropriate content and has been blocked.');
          }
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentEmployee?.employee_id]);

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

    if (!currentEmployee) {
      setMessage('Could not find employee record.');
      setLoading(false);
      return;
    }

    // Queue the content for safety analysis (similar to chat message queueing)
    try {
      // First, enqueue the content for analysis using the same pattern as chat
      const { error: queueError } = await supabase.rpc('send', {
        queue_name: 'time_off_requests',
        message: {
          employee_id: currentEmployee.employee_id,
          content: reason,
          request_data: {
            start_date: start.toISOString().split('T')[0],
            end_date: end.toISOString().split('T')[0],
            reason,
          },
          timestamp: new Date().toISOString()
        }
      });

      if (queueError) {
        console.error('Queue error:', queueError);
        // Fallback to direct submission without content safety
        await submitDirectly();
        return;
      }

      // Show processing message
      setMessage('Your request is being processed and will be submitted after content review...');
      setLoading(false);
      
      // Clear form optimistically (similar to chat)
      setRange({ start: null, end: null });
      setReason('');
      
    } catch (err) {
      console.error('Submission error:', err);
      // Fallback to direct submission
      await submitDirectly();
    }
  };

  // Fallback direct submission method
  const submitDirectly = async () => {
    try {
      const requestPayload = {
        employee_id: currentEmployee.employee_id,
        request_type: 'time-off',
        request: {
          start_date: range.start.toISOString().split('T')[0],
          end_date: range.end.toISOString().split('T')[0],
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
    <>
      {/* Content Safety Alert Modal (same pattern as chat) */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <h2 className="text-xl font-bold mb-4 text-red-700">Content Policy Violation</h2>
            <p className="mb-6 text-gray-800">{alertModalMsg}</p>
            <button
              onClick={() => setShowAlertModal(false)}
              className="px-6 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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
            <InputField
              label="Start Date"
              name="start-date"
              type="text"
              value={range.start ? range.start.toLocaleDateString() : ''}
              onChange={() => {}} // Read-only field
              readOnly
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              required
            />
          </div>
          <div>
            <InputField
              label="End Date"
              name="end-date"
              type="text"
              value={range.end ? range.end.toLocaleDateString() : ''}
              onChange={() => {}} // Read-only field
              readOnly
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              required
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
    </>
  );
};

export default TimeOffRequestPage;