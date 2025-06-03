import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const AddEmployee = () => {
  const [form, setForm] = useState({
    email: '',
    store_id: '',
    role_id: '',
    employee_id: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email) {
      setError('Please enter an email');
      return;
    }
    setLoading(true);
    try {
      // Generate a unique invite token
      const token = uuidv4();
      // Build the invite link with all params
      const link = `${window.location.origin}/setup-account?email=${encodeURIComponent(form.email)}&token=${token}&role_id=${form.role_id || ''}&store_id=${form.store_id || ''}&employee_id=${form.employee_id || ''}`;
      setSuccess('Invitation link generated!');
      setInviteLink(link);
      setForm({ email: '', store_id: '', role_id: '', employee_id: '' });
    } catch (err) {
      console.error('Error generating invite link:', err.message);
      setError('Failed to generate invitation link');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 py-8">
      <div className="w-full max-w-lg bg-white shadow-lg rounded-lg p-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Send Invitation</h1>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
          >
            Back
          </button>
        </div>
        {error && <p className="mb-4 text-center text-red-500">{error}</p>}
        {success && <p className="mb-4 text-center text-green-600">{success}</p>}
        {inviteLink && (
          <div className="mb-4 text-center text-blue-600 break-all">
            Invitation Link: <a href={inviteLink} className="underline">{inviteLink}</a>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Store ID
            </label>
            <input
              type="text"
              name="store_id"
              value={form.store_id}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Role ID
            </label>
            <input
              type="text"
              name="role_id"
              value={form.role_id}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Employee ID
            </label>
            <input
              type="number"
              name="employee_id"
              value={form.employee_id || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
              min="1"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {loading ? 'Generating...' : 'Generate Invite Link'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddEmployee;