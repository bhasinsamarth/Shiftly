import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

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
    // Fields to be pre-filled from URL
    employee_id: '',
    store_id: '',
    role_id: '',
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailFromUrl = params.get('email') || '';
    const employeeIdFromUrl = params.get('employee_id') || '';
    const storeIdFromUrl = params.get('store_id') || '';
    const roleIdFromUrl = params.get('role_id') || '';

    if (!emailFromUrl) {
        setError('Invalid invitation link: Email is missing.');
        // Optionally, disable the form or redirect
    }
    if (!roleIdFromUrl) {
        setError('Invalid invitation link: Role ID is missing.');
    }
    if (!storeIdFromUrl) {
        setError('Invalid invitation link: Store ID is missing.');
    }

    setForm((prev) => ({
      ...prev,
      email: emailFromUrl,
      employee_id: employeeIdFromUrl,
      store_id: storeIdFromUrl,
      role_id: roleIdFromUrl,
    }));
  }, [location.search]);

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
    setError(''); // Clear previous errors
    setSuccess('');

    // Validate required fields from the form state (which includes URL params)
    if (!form.email || !form.password || !form.confirmPassword || !form.first_name || !form.date_of_birth || !form.gender || !form.address_line_1 || !form.city || !form.province || !form.country || !form.phone || !form.role_id || !form.store_id) {
      setError('Please fill in all required fields. Some information might be missing from the invitation link.');
      return;
    }
    if (!validatePassword(form.password)) {
      setPasswordError('Password must be at least 8 characters and include lowercase, uppercase, a digit, and a symbol.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      setError('Passwords do not match.'); // Also set general error
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
        .from('users') // This should be auth.users table, but direct query is not standard for client-side.
                       // Supabase client library usually handles user context after signUp.
                       // If signUpData.user is null and no error, it might mean email confirmation is pending.
        .select('id')
        .eq('email', form.email)
        .single();

      if (userFetchError || !userRows) {
        setError('Account created, but failed to retrieve user ID for employee record. Please contact support if this issue persists after verifying your email.');
        setLoading(false);
        return;
      }
      userId = userRows.id;
    }

    // Ensure employee_id, store_id, and role_id are from the form state (pre-filled from URL)
    const employeeIdToInsert = form.employee_id ? parseInt(form.employee_id, 10) : null; // Allow null if not provided
    const storeIdToInsert = form.store_id ? parseInt(form.store_id, 10) : null;
    const roleIdToInsert = form.role_id ? parseInt(form.role_id, 10) : null;

    if (!storeIdToInsert || !roleIdToInsert) {
        setError('Store ID and Role ID are required. Information may be missing from the invitation link.');
        setLoading(false);
        return;
    }

    const { error: insertError } = await supabase
      .from('employee')
      .insert([
        {
          id: userId, // This is the UUID from auth.users
          employee_id: employeeIdToInsert,
          store_id: storeIdToInsert,
          role_id: roleIdToInsert,
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
        {error && <p className="mb-4 text-center text-red-500 bg-red-100 p-3 rounded-md">{error}</p>} {/* Enhanced error display */}
        {success && <p className="mb-4 text-center text-green-600 bg-green-100 p-3 rounded-md">{success}</p>} {/* Enhanced success display */}
        
        {/* Display pre-filled and non-editable info from invite */}
        <div className="mb-4 p-4 bg-gray-100 rounded-md">
            <p className="text-sm text-gray-700">Invited Email: <span className="font-semibold">{form.email || 'Loading...'}</span></p>
            <p className="text-sm text-gray-700">Store ID: <span className="font-semibold">{form.store_id || 'Not specified'}</span></p>
            <p className="text-sm text-gray-700">Role ID: <span className="font-semibold">{form.role_id || 'Not specified'}</span></p>
            {form.employee_id && <p className="text-sm text-gray-700">Employee ID: <span className="font-semibold">{form.employee_id}</span></p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email field is removed as it's displayed above and non-editable */}
          {/* Password and Confirm Password fields */}
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
