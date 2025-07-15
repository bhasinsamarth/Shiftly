import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const steps = [
  { label: 'Password', fields: ['email', 'password', 'confirmPassword'] },
  { label: 'Personal Information', fields: ['first_name', 'middle_name', 'last_name', 'preferred_name', 'date_of_birth', 'gender'] },
  { label: 'Address', fields: ['address_line_1', 'address_line_2', 'postal_code', 'city', 'province', 'country', 'phone'] },
];

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
  const [inviteExpired, setInviteExpired] = useState(false);
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (!token) {
      setError('Invalid or missing invitation token.');
      return;
    }
    // Fetch invite details from setup_tokens
    const fetchInvite = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('setup_tokens')
        .select('*')
        .eq('token', token)
        .single();
      setLoading(false);
      if (fetchError || !data) {
        setError('Invalid or expired invitation link.');
        return;
      }
      // Check if token has already been used
      if (data.is_used) {
        setError('This invitation has already been used. Please request a new invitation.');
        return;
      }
      
      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setInviteExpired(true);
        return;
      }
      // Pre-fill form with invite data
      setForm((prev) => ({
        ...prev,
        email: data.email || '',
        employee_id: data.employee_id ? String(data.employee_id) : '',
        store_id: data.store_id ? String(data.store_id) : '',
        role_id: data.role_id ? String(data.role_id) : '',
      }));
    };
    fetchInvite();
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

  const handleNext = (e) => {
    e.preventDefault();
    // Validate current step fields
    let valid = true;
    for (const field of steps[step].fields) {
      if (['middle_name', 'last_name', 'preferred_name', 'address_line_2'].includes(field)) continue;
      if (!form[field]) valid = false;
    }
    if (!valid) {
      setError('Please fill in all required fields.');
      return;
    }
    if (step === 0) {
      if (!validatePassword(form.password)) {
        setPasswordError('Password must be at least 8 characters and include lowercase, uppercase, a digit, and a symbol.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setConfirmPasswordError('Passwords do not match.');
        return;
      }
    }
    setError('');
    setStep(step + 1);
  };

  const handleBack = (e) => {
    e.preventDefault();
    setError('');
    setStep(step - 1);
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
    // 3. Insert into employee table with id = userId and employee_id, role_id, store_id from setup_tokens (already in form)
    const { error: insertError } = await supabase
      .from('employee')
      .insert([
        {
          id: userId, // This is the UUID from auth.users
          employee_id: form.employee_id || undefined, // From setup_tokens
          role_id: form.role_id ? parseInt(form.role_id, 10) : undefined, // From setup_tokens
          store_id: form.store_id ? parseInt(form.store_id, 10) : undefined, // From setup_tokens
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
    // Mark the invitation token as used
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    
    const { error: updateTokenError } = await supabase
      .from('setup_tokens')
      .update({ is_used: true })
      .eq('token', token);
      
    if (updateTokenError) {
      console.error('Failed to mark token as used:', updateTokenError);
      // Continue anyway as the account has been created successfully
    }
    
    setSuccess('Account setup complete!');
    setShowEmailPopup(true);
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

  if (showEmailPopup) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-4 text-blue-700">Almost there!</h2>
          <p className="mb-4 text-gray-700">Check your email to confirm your account.</p>
          <button
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            onClick={() => navigate('/login')}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 py-8">
      <div className="w-full max-w-md bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Set Up Your Account</h1>
        <div className="flex items-center justify-between mb-6">
          {steps.map((s, idx) => (
            <React.Fragment key={s.label}>
              <div className={`flex flex-col items-center ${idx === step ? 'text-blue-700 font-bold' : 'text-gray-400'}`}>
                <div className={`rounded-full w-7 h-7 flex items-center justify-center border-2 ${idx === step ? 'border-blue-700 bg-blue-100' : 'border-gray-300 bg-white'}`}>{idx + 1}</div>
                <span className="text-xs mt-1">{s.label}</span>
              </div>
              {idx < steps.length - 1 && <div className="flex-1 h-0.5 bg-gray-200 mx-2" />}
            </React.Fragment>
          ))}
        </div>
        {success && <p className="mb-4 text-green-600">{success}</p>}
        <form onSubmit={step === steps.length - 1 ? handleSubmit : handleNext} className="space-y-6">
          {step === 0 && (
            <>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Email <span className="text-red-500">*</span></label>
                <input type="email" name="email" value={form.email} readOnly className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed" required />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Password <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(min 8 chars, lowercase, uppercase, digits & symbols recommended)</span></label>
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
                <label className="block text-gray-700 font-medium mb-2">Confirm Password <span className="text-red-500">*</span></label>
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
            </>
          )}
          {step === 1 && (
            <>
              <div>
                <label className="block text-gray-700 font-medium mb-2">First Name <span className="text-red-500">*</span></label>
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
                <label className="block text-gray-700 font-medium mb-2">Date of Birth <span className="text-red-500">*</span></label>
                <input type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Gender <span className="text-red-500">*</span></label>
                <select name="gender" value={form.gender} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Address Line 1 <span className="text-red-500">*</span></label>
                <input type="text" name="address_line_1" value={form.address_line_1} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Address Line 2</label>
                <input type="text" name="address_line_2" value={form.address_line_2} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Postal Code <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(e.g. A1A 1A1)</span></label>
                <input type="text" name="postal_code" value={form.postal_code} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">City <span className="text-red-500">*</span></label>
                <input type="text" name="city" value={form.city} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Province <span className="text-red-500">*</span></label>
                <input type="text" name="province" value={form.province} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Country <span className="text-red-500">*</span></label>
                <input type="text" name="country" value={form.country} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Phone <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(10 digits, e.g. 4035551234)</span></label>
                <input type="text" name="phone" value={form.phone} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500" required />
              </div>
            </>
          )}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <div className="flex justify-between mt-6">
            {step > 0 && (
              <button onClick={handleBack} className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors">Back</button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 ml-2 bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {loading ? 'Setting Up...' : step === steps.length - 1 ? 'Set Up Account' : 'Next'}
            </button>
          </div>
        </form>
        {inviteExpired && (
          <div className="mt-4 text-red-500 text-sm">
            This invitation link has expired. Please contact your administrator for a new invitation.
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupAccountPage;
