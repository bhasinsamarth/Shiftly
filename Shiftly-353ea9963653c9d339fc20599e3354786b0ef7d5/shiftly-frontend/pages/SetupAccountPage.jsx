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
    employee_id: '',
    store_id: '',
    role_id: '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // 1. Pre‐fill from invite link
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailFromUrl    = params.get('email')    || '';
    const employeeIdFromUrl = params.get('employee_id') || '';
    const storeIdFromUrl  = params.get('store_id')  || '';
    const roleIdFromUrl   = params.get('role_id')   || '';

    setForm(f => ({
      ...f,
      email:     emailFromUrl,
      employee_id: employeeIdFromUrl,
      store_id:  storeIdFromUrl,
      role_id:   roleIdFromUrl,
    }));

    if (!emailFromUrl || !storeIdFromUrl || !roleIdFromUrl) {
      setError('Invalid invitation link: missing required parameters.');
    }
  }, [location.search]);

  // 2. Password validation
  const validatePassword = pwd =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*\W).{8,}$/.test(pwd);

  // 3. Form field changes
  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (error) setError('');

    if (name === 'password') {
      setPasswordError(
        validatePassword(value)
          ? ''
          : 'Min 8 chars with lowercase, uppercase, digit & symbol.'
      );
      if (form.confirmPassword && value !== form.confirmPassword) {
        setConfirmPasswordError('Passwords do not match.');
      } else {
        setConfirmPasswordError('');
      }
    }
    if (name === 'confirmPassword') {
      setConfirmPasswordError(
        value !== form.password ? 'Passwords do not match.' : ''
      );
    }
  };

  // 4. Submit handler
  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setSuccess('');

    // Basic required‐field check
    const required = [
      'email','password','confirmPassword',
      'first_name','date_of_birth','gender',
      'address_line_1','city','province','country',
      'phone','store_id','role_id'
    ];
    for (let key of required) {
      if (!form[key]) {
        setError('Please fill in all required fields.');
        return;
      }
    }
    if (!validatePassword(form.password)) {
      setPasswordError('Min 8 chars with lowercase, uppercase, digit & symbol.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      return;
    }

    setLoading(true);
    // 4.1 Sign up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    let userId = signUpData?.user?.id;
    // If userId missing, try fetching by email (rare)
    if (!userId) {
      const { data: userRow, error: userErr } = await supabase
        .from('auth.users')
        .select('id')
        .eq('email', form.email)
        .single();
      if (userErr || !userRow) {
        setError('Signed up but could not fetch user ID.');
        setLoading(false);
        return;
      }
      userId = userRow.id;
    }

    // 4.2 Insert employee record
    const employeeIdNum = parseInt(form.employee_id, 10) || null;
    const storeIdNum    = parseInt(form.store_id, 10);
    const roleIdNum     = parseInt(form.role_id, 10);

    const { error: insertErr } = await supabase
      .from('employee')
      .insert([{
        id:                userId,
        employee_id:       employeeIdNum,
        store_id:          storeIdNum,
        role_id:           roleIdNum,
        email:             form.email,
        first_name:        form.first_name,
        middle_name:       form.middle_name,
        last_name:         form.last_name,
        preferred_name:    form.preferred_name,
        date_of_birth:     form.date_of_birth,
        gender:            form.gender,
        address_line_1:    form.address_line_1,
        address_line_2:    form.address_line_2,
        postal_code:       form.postal_code,
        city:              form.city,
        province:          form.province,
        country:           form.country,
        phone:             form.phone,
      }]);
    if (insertErr) {
      setError(`Failed to save employee: ${insertErr.message}`);
      setLoading(false);
      return;
    }

    // 4.3 Upload photo if provided
    if (photoFile) {
      const safeEmail = form.email.replace(/[@.]/g, '_');
      const photoPath = `employee-photo/${employeeIdNum}_${safeEmail}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photo')
        .upload(photoPath, photoFile, {
          cacheControl: '3600',
          upsert:       true,
          contentType:  photoFile.type,
        });
      if (uploadError) {
        console.error('Photo upload failed:', uploadError.message);
      } else {
        // 4.4 Save path to employee row
        await supabase
          .from('employee')
          .update({ profile_photo_path: photoPath })
          .eq('id', userId);
      }
    }

    setSuccess('Account setup complete! Redirecting…');
    setTimeout(() => navigate('/login'), 2000);
    setLoading(false);
  };

  // 5. Render
  if (error && !success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded shadow-md text-red-600">
          <h2 className="text-xl font-bold mb-4">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 py-8">
      <div className="w-full max-w-md bg-white p-8 rounded shadow">
        <h1 className="text-2xl font-bold mb-6">Set Up Your Account</h1>
        {error && <div className="mb-4 p-2 bg-red-100 text-red-600 rounded">{error}</div>}
        {success && <div className="mb-4 p-2 bg-green-100 text-green-600 rounded">{success}</div>}

        {/* Invite info (read‐only) */}
        <div className="mb-4 p-4 bg-gray-100 rounded">
          <p>Email: <strong>{form.email}</strong></p>
          <p>Store ID: <strong>{form.store_id}</strong></p>
          <p>Role ID: <strong>{form.role_id}</strong></p>
          {form.employee_id && <p>Employee ID: <strong>{form.employee_id}</strong></p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password */}
          <div>
            <label className="block font-medium">Password *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                className={`w-full border px-3 py-2 rounded ${
                  passwordError ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-2 top-2 text-sm"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block font-medium">Confirm Password *</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                className={`w-full border px-3 py-2 rounded ${
                  confirmPasswordError ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(p => !p)}
                className="absolute right-2 top-2 text-sm"
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {confirmPasswordError && <p className="text-red-500 text-sm">{confirmPasswordError}</p>}
          </div>

          {/* Names, DOB, Gender, Address, Phone */}
          <div>
            <label className="block font-medium">First Name *</label>
            <input
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block font-medium">Middle Name</label>
            <input
              name="middle_name"
              value={form.middle_name}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block font-medium">Last Name</label>
            <input
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block font-medium">Preferred Name</label>
            <input
              name="preferred_name"
              value={form.preferred_name}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block font-medium">Date of Birth *</label>
            <input
              type="date"
              name="date_of_birth"
              value={form.date_of_birth}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block font-medium">Gender *</label>
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              required
            >
              <option value="">Select</option>
              <option>Male</option>
              <option>Female</option>
              <option>Prefer not to say</option>
            </select>
          </div>
          <div>
            <label className="block font-medium">Address Line 1 *</label>
            <input
              name="address_line_1"
              value={form.address_line_1}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block font-medium">Address Line 2</label>
            <input
              name="address_line_2"
              value={form.address_line_2}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block font-medium">Postal Code *</label>
            <input
              name="postal_code"
              value={form.postal_code}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block font-medium">City *</label>
            <input
              name="city"
              value={form.city}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block font-medium">Province *</label>
            <input
              name="province"
              value={form.province}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block font-medium">Country *</label>
            <input
              name="country"
              value={form.country}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block font-medium">Phone *</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>

          {/* Profile Photo */}
          <div>
            <label className="block font-medium">
              Profile Photo <span className="text-gray-500 text-sm">(jpg/png)</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setPhotoFile(e.target.files[0])}
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
          >
            {loading ? 'Setting Up…' : 'Set Up Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupAccountPage;
