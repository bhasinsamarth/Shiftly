// src/components/AddEmployee.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';

// endpoint of your mail-sending backend
const MAILER_API = import.meta.env.VITE_MAILER_API || 'http://localhost:3001/send-invite';

const AddEmployee = () => {
  const [form, setForm] = useState({
    email: '',
    store_id: '',
    role_id: '',
    employee_id: '',
  });
  const [stores, setStores] = useState([]);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const { data, error } = await supabase.from('store').select('store_id, store_name');
        if (error) throw error;
        setStores(data);
      } catch (err) {
        console.error('Error fetching stores:', err);
      }
    };
    fetchStores();
  }, []);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase.from('role').select('role_id, role_name').neq('role_id', 1);
        if (error) throw error;
        setRoles(data);
      } catch (err) {
        console.error('Error fetching roles:', err);
      }
    };
    fetchRoles();
  }, []);

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
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const createdAt = new Date().toISOString();

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
            Invitation Link:{' '}
            <a href={inviteLink} className="underline">
              {inviteLink}
            </a>
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
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Store ID <span className="text-gray-400">(optional)</span>
            </label>
            <select
              name="store_id"
              value={form.store_id}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
            >
              <option value="">Select a store</option>
              {stores.map((store) => (
                <option key={store.store_id} value={store.store_id}>{store.store_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Role ID <span className="text-gray-400">(optional)</span>
            </label>
            <select
              name="role_id"
              value={form.role_id}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
            >
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role.role_id} value={role.role_id}>{role.role_desc}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Employee ID <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="number"
              name="employee_id"
              value={form.employee_id}
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
