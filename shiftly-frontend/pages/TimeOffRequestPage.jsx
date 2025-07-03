import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import RangeCalendar from '../components/RangeCalendar';

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
      const { error } = await supabase.from('time_off_requests').insert([{
        employee_id: user.id,
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
        reason,
        status: 'pending',
      }]);

      if (error) {
        setMessage('Failed to submit request.');
      } else {
        setMessage('Time off request submitted!');
        setRange({ start: null, end: null });
        setReason('');
      }
    } catch (err) {
      setMessage('An error occurred.');
    }

    setLoading(false);
  };

  const handleRangeSelect = ({ start, end }) => {
    setRange({ start, end });
  };

  return (
    <div className="flex flex-col md:flex-row max-w-4xl mx-auto mt-10 bg-white rounded-lg shadow overflow-hidden">
      {/* Calendar on the left */}
      <div className="md:w-1/2 w-full flex flex-col items-center justify-center bg-gray-50 p-6 border-r">
        <h3 className="text-lg font-semibold mb-4 text-center">Select Date Range</h3>
        <RangeCalendar onRangeSelect={handleRangeSelect} />
        {range.start && range.end && (
          <div className="mt-4 text-center text-sm">
            <strong>Selected Range:</strong>
            <div>{range.start.toDateString()} &ndash; {range.end.toDateString()}</div>
          </div>
        )}
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
              onChange={e => setReason(e.target.value)}
              required
              rows={3}
            />
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
