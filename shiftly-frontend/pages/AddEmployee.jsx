// src/pages/AddEmployee.jsx
import React, { useState, useEffect} from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import DropdownMenu from '../components/DropdownMenu';

// endpoint of your mail-sending backend
const MAILER_API = import.meta.env.VITE_MAILER_API;

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

  // We no longer need these fetch effects since the DropdownSelect component
  //DropDown menu will handle fetching the data directly from the database

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email) {
      setError('Please enter an email');
      return;
    }

    if (!form.store_id) {
      setError('Please select a store');
      return;
    }

    if (!form.role_id) {
      setError('Please enter a role ID');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setInviteLink('');

    try {
      // Generate a secure random token
      const token = uuidv4();
      // Set expiry 24 hours from now
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      

      // Build the invite object
      const inviteData = {
        token,
        email: form.email,
        role_id: form.role_id ? parseInt(form.role_id, 10) : null,
        store_id: form.store_id ? parseInt(form.store_id, 10) : null,
        expires_at: expiresAt,
        created_at: createdAt,
        is_used: false,
      };
      // If employee_id is provided, add it to the inviteData
      // This is optional, so we check if it's present
      if (form.employee_id) {
        inviteData.employee_id = parseInt(form.employee_id, 10);
      }

      // Insert token into setup_tokens
      const { data: insertData, error: tokenInsertError } = await supabase
        .from('setup_tokens')
        .insert([inviteData])
        .select();
      if (tokenInsertError) {
        console.error('Supabase insert error:', tokenInsertError);
        throw new Error('Failed to generate invitation token.');
      }

      // Build the invite link
      const link = `${window.location.origin}/setup-account?token=${token}`;
      setSuccess('Invitation link generated!');
      setInviteLink(link);

      // --- Send the invitation email ---
      const mailResp = await fetch(MAILER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, link }),
      });
      if (!mailResp.ok) {
        const { error: mailError } = await mailResp.json().catch(() => ({}));
        console.error('Mail send error:', mailError);
        setError('Failed to send invite email.');
      }

      // Clear the form on success
      setForm({ email: '', store_id: '', role_id: '', employee_id: '' });
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setError(err.message || 'Error generating invitation link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Add employee</h1>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-md max-w-md sm:max-w-md lg:max-w-lg">
            <p className="text-xs sm:text-sm text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-md max-w-md sm:max-w-md lg:max-w-lg">
            <p className="text-xs sm:text-sm text-green-600">{success}</p>
          </div>
        )}
        {inviteLink && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-md max-w-md sm:max-w-md lg:max-w-lg">
            <p className="text-xs sm:text-sm text-blue-600 mb-2">Invitation Link Generated:</p>
            <a 
              href={inviteLink} 
              className="text-xs sm:text-sm text-blue-700 underline break-all hover:text-blue-800"
              target="_blank"
              rel="noopener noreferrer"
            >
              {inviteLink}
            </a>
          </div>
        )}

        {/* Form - More compact width */}
        <div className="max-w-sm">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Email Address */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                Email address
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="john.employee@email.com"
                className="w-80 px-3 py-2 sm:py-2.5 bg-white border border-gray-300 rounded-md text-xs sm:text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                required
              />
            </div>

            {/* Store ID */}
            <div>
              <DropdownMenu
                label="Store ID"
                name="store_id"
                value={form.store_id}
                onChange={handleChange}
                tableName="store"
                valueField="store_id"
                displayField="store_name"
                placeholder="Enter store ID"
                className="w-80 px-3 py-2 sm:py-2.5 bg-white border border-gray-300 rounded-md text-xs sm:text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                required={true}
              />
            </div>

            {/* Role */}
            <div>
              <DropdownMenu
                label="Role"
                name="role_id"
                value={form.role_id}
                onChange={handleChange}
                tableName="role"
                valueField="role_id"
                displayField="role_desc"
                filterField="role_id"
                filterValue={1}
                filterOperator="neq"
                placeholder="Select role"
                className="w-80 px-3 py-2 sm:py-2.5 bg-white border border-gray-300 rounded-md text-xs sm:text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                required={true}
              />
            </div>

            {/* Employee ID */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                Employee ID
              </label>
              <input
                type="number"
                name="employee_id"
                value={form.employee_id}
                onChange={handleChange}
                placeholder="Enter employee ID"
                className="w-80 px-3 py-2 sm:py-2.5 bg-white border border-gray-300 rounded-md text-xs sm:text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                min="1"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-3 sm:pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-auto bg-blue-600 text-white py-2.5 px-6 rounded-md text-xs sm:text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {loading ? 'Adding employee...' : 'Add employee'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddEmployee;

