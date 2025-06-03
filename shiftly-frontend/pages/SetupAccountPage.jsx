import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const SetupAccountPage = () => {
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    preferred_name: '',
    date_of_birth: '',
    gender: '',
    address_line_1: '',
    address_line_2: '',
    postal_code: '',
    city: '',
    province: '',
    country: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Extract token, email, store_id, role_id from URL
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const email = params.get('email') || '';

  useEffect(() => {
    // Prefill form fields from URL params
    setForm((prev) => ({
      ...prev,
      email: email,
      employee_id: params.get('employee_id') || '',
    }));
  }, [email]);

  const validatePassword = (password) => {
    // Minimum 8 characters, at least one lowercase, one uppercase, one digit, one symbol
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
    return regex.test(password);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (error) setError('');

    if (name === 'password') {
      if (!validatePassword(value)) {
        setPasswordError('Password must be at least 8 characters and include lowercase, uppercase, a digit, and a symbol.');
      } else {
        setPasswordError('');
      }
      // Also check confirm password if filled
      if (form.confirmPassword && value !== form.confirmPassword) {
        setConfirmPasswordError('Passwords do not match.');
      } else {
        setConfirmPasswordError('');
      }
    }
    if (name === 'confirmPassword') {
      if (value !== form.password) {
        setConfirmPasswordError('Passwords do not match.');
      } else {
        setConfirmPasswordError('');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate required fields
    if (!form.email || !form.password || !form.confirmPassword || !form.first_name || !form.date_of_birth || !form.gender || !form.address_line_1 || !form.city || !form.province || !form.country || !form.phone) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!validatePassword(form.password)) {
      setPasswordError('Password must be at least 8 characters and include lowercase, uppercase, a digit, and a symbol.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      return;
    }
    setLoading(true);
    // 1. Create Supabase Auth user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    // 2. Fetch the user's UUID from auth.users
    let userId = signUpData?.user?.id;
    if (!userId) {
      // fallback: fetch by email
      const { data: userRows, error: userFetchError } = await supabase
        .from('users')
        .select('id')
        .eq('email', form.email)
        .single();
      if (userFetchError || !userRows) {
        setError('Account created, but failed to fetch user ID for employee record.');
        setLoading(false);
        return;
      }
      userId = userRows.id;
    }
    // 3. Insert into employee table with id = userId and employee_id from params (set by owner)
    const { error: insertError } = await supabase
      .from('employee')
      .insert([
        {
          id: userId, // This is the UUID from auth.users
          employee_id: params.get('employee_id') || undefined, // This is set by the owner
          email: form.email,
          first_name: form.first_name,
          middle_name: form.middle_name,
          last_name: form.last_name, // optional
          preferred_name: form.preferred_name,
          date_of_birth: form.date_of_birth,
          gender: form.gender,
          address_line_1: form.address_line_1,
          address_line_2: form.address_line_2,
          postal_code: form.postal_code,
          city: form.city,
          province: form.province,
          country: form.country,
          phone: form.phone,
        },
      ]);
    if (insertError) {
      setError(`Account created, but failed to save employee details.\n${insertError.message}`);
      setLoading(false);
      return;
    }
    setSuccess('Account setup complete! You can now log in.');
    setTimeout(() => navigate('/login'), 2000);
    setLoading(false);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 py-8">
        <div className="w-full max-w-md bg-white shadow-lg rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
          <p className="mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 py-8">
      <div className="w-full max-w-md bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Set Up Your Account</h1>
        <p className="mb-4 text-gray-600">Email: <span className="font-semibold">{form.email}</span></p>
        {success && <p className="mb-4 text-green-600">{success}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email, Password, Confirm Password fields (email is prefilled and readOnly) */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Email <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(e.g. example@email.com)</span>
            </label>
            <input type="email" name="email" value={form.email} readOnly className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed" required />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Password <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(min 8 chars, lowercase, uppercase, digits & symbols recommended)</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                className={`w-full px-4 py-2 border ${passwordError ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring focus:border-blue-500`}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {passwordError && <p className="text-red-500 text-xs mt-1">{passwordError}</p>}
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                className={`w-full px-4 py-2 border ${confirmPasswordError ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring focus:border-blue-500`}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                tabIndex={-1}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
            {confirmPasswordError && <p className="text-red-500 text-xs mt-1">{confirmPasswordError}</p>}
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              First Name <span className="text-red-500">*</span>
            </label>
            <input type="text" name="first_name" value={form.first_name} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">Middle Name</label>
            <input type="text" name="middle_name" value={form.middle_name} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">Last Name</label>
            <input type="text" name="last_name" value={form.last_name} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">Preferred Name</label>
            <input type="text" name="preferred_name" value={form.preferred_name} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Date of Birth <span className="text-red-500">*</span>
            </label>
            <input type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Gender <span className="text-red-500">*</span>
            </label>
            <select name="gender" value={form.gender} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required>
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Address Line 1 <span className="text-red-500">*</span>
            </label>
            <input type="text" name="address_line_1" value={form.address_line_1} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">Address Line 2</label>
            <input type="text" name="address_line_2" value={form.address_line_2} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Postal Code <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(e.g. A1A 1A1)</span>
            </label>
            <input type="text" name="postal_code" value={form.postal_code} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              City <span className="text-red-500">*</span>
            </label>
            <input type="text" name="city" value={form.city} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Province <span className="text-red-500">*</span>
            </label>
            <input type="text" name="province" value={form.province} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Country <span className="text-red-500">*</span>
            </label>
            <input type="text" name="country" value={form.country} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Phone <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(10 digits, e.g. 4035551234)</span>
            </label>
            <input type="text" name="phone" value={form.phone} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {loading ? 'Setting Up...' : 'Set Up Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupAccountPage;
