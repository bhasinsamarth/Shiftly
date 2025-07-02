import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import CalendarWidget from '../components/CalendarWidget';

const TimeOffRequestPage = () => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState('start'); // 'start' or 'end'

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    if (!startDate || !endDate || !reason) {
      setMessage('Please fill in all fields.');
      setLoading(false);
      return;
    }
    if (endDate < startDate) {
      setMessage('End date cannot be before start date.');
      setLoading(false);
      return;
    }
    try {
      const { error } = await supabase.from('time_off_requests').insert([
        {
          employee_id: user.id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          reason,
          status: 'pending',
        },
      ]);
      if (error) {
        setMessage('Failed to submit request.');
      } else {
        setMessage('Time off request submitted!');
        setStartDate(null);
        setEndDate(null);
        setReason('');
      }
    } catch (err) {
      setMessage('An error occurred.');
    }
    setLoading(false);
  };

  // Handler for calendar date selection
  const handleCalendarSelect = (date) => {
    if (selecting === 'start') {
      setStartDate(date);
      setSelecting('end');
    } else if (selecting === 'end') {
      setEndDate(date);
      setSelecting(null);
    }
  };

  return (
    <div className="flex flex-col md:flex-row max-w-4xl mx-auto mt-10 bg-white rounded-lg shadow overflow-hidden">
      {/* Calendar on the left */}
      <div className="md:w-1/2 w-full flex flex-col items-center justify-center bg-gray-50 p-6 border-r">
        <h3 className="text-lg font-semibold mb-4 text-center">Select Dates</h3>
        <CalendarWidget
          initialDate={selecting === 'end' ? (endDate || startDate || undefined) : (startDate || undefined)}
          onDateSelect={handleCalendarSelect}
          startDate={startDate}
          endDate={endDate}
        />
        <div className="mt-6 w-full flex flex-col items-center">
          <button
            type="button"
            className={`mb-2 px-3 py-2 border rounded w-48 ${selecting === 'start' ? 'border-blue-600' : 'border-gray-300'}`}
            onClick={() => setSelecting('start')}
          >
            {startDate ? `Start: ${startDate.toLocaleDateString()}` : 'Select Start Date'}
          </button>
          <button
            type="button"
            className={`px-3 py-2 border rounded w-48 ${selecting === 'end' ? 'border-blue-600' : 'border-gray-300'}`}
            onClick={() => setSelecting('end')}
          >
            {endDate ? `End: ${endDate.toLocaleDateString()}` : 'Select End Date'}
          </button>
        </div>
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
              value={startDate ? startDate.toLocaleDateString() : ''}
              readOnly
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">End Date</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
              value={endDate ? endDate.toLocaleDateString() : ''}
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
