import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];

const ProfilePage = () => {
  const { user, loading: authLoading, fetchDbUser } = useAuth();
  const [formData, setFormData] = useState({
    preferred_name: '',
    gender: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    province: '',
    country: '',
    postal_code: '',
    phone: '',
  });
  const [initialFormData, setInitialFormData] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [initialDataLoading, setInitialDataLoading] = useState(true);

  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    const fetchEmployeePhoto = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('employee')
          .select('profile_photo_path')
          .eq('id', user.id)
          .single();

        if (data?.profile_photo_path) {
          const { data: publicUrl } = supabase.storage
            .from('profile-photo')
            .getPublicUrl(data.profile_photo_path);

          setPhotoUrl(publicUrl.publicUrl);
        }
      }
    };
    fetchEmployeePhoto();
  }, [user]);

  useEffect(() => {
    if (user) {
      const editableData = {
        preferred_name: user.preferred_name || '',
        gender: user.gender || '',
        address_line_1: user.address_line_1 || '',
        address_line_2: user.address_line_2 || '',
        city: user.city || '',
        province: user.province || '',
        country: user.country || '',
        postal_code: user.postal_code || '',
        phone: user.phone || '',
      };

      setFormData(editableData);
      setInitialFormData({ ...editableData });
      setInitialDataLoading(false);
    } else if (!authLoading) {
      setInitialDataLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    let changed = false;
    for (const key of Object.keys(formData)) {
      if (String(formData[key] || '') !== String(initialFormData[key] || '')) {
        changed = true;
        break;
      }
    }
    setHasUnsavedChanges(changed);
  }, [formData, initialFormData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '-');
    const path = `${Date.now()}-${cleanName}`;

    setUploadingPhoto(true);

    const { error: uploadError } = await supabase.storage
      .from('profile-photo')
      .upload(path, file, {
        upsert: true,
        cacheControl: '3600',
        contentType: file.type || 'image/jpeg',
      });

    if (uploadError) {
      setMessage({ type: 'error', text: `Upload failed: ${uploadError.message}` });
      setUploadingPhoto(false);
      return;
    }

    const { data } = supabase.storage
      .from('profile-photo')
      .getPublicUrl(path);

    setPhotoUrl(data.publicUrl);
    setMessage({ type: 'success', text: 'Photo uploaded successfully!' });

    const { error: updateError } = await supabase
      .from('employee')
      .update({ profile_photo_path: path })
      .eq('id', user.id);

    if (updateError) {
      setMessage({ type: 'error', text: `Failed to save photo path: ${updateError.message}` });
    }

    setUploadingPhoto(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setIsSubmitting(true);

    const updates = {
      preferred_name: formData.preferred_name,
      gender: formData.gender,
      address_line_1: formData.address_line_1,
      address_line_2: formData.address_line_2,
      city: formData.city,
      province: formData.province,
      country: formData.country,
      postal_code: formData.postal_code,
      phone: formData.phone,
    };

    const { error } = await supabase
      .from('employee')
      .update(updates)
      .eq('id', user.id);

    setIsSubmitting(false);

    if (error) {
      setMessage({ type: 'error', text: `Failed to update profile: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      if (fetchDbUser) await fetchDbUser(user.id);
      setInitialFormData({ ...formData });
      setHasUnsavedChanges(false);
    }
  };

  const renderInputField = (label, id, value, span = "md:col-span-1") => (
    <div className={span}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        name={id}
        id={id}
        value={value || ''}
        onChange={handleChange}
        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      />
    </div>
  );

  const renderDisplayField = (label, value, span = "md:col-span-1") => (
    <div className={span}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <p className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm sm:text-sm text-gray-700">
        {value || <span className="text-gray-400 italic">Not set</span>}
      </p>
    </div>
  );

  const renderSelectField = (label, id, value, options, span = "md:col-span-1") => (
    <div className={span}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        name={id}
        id={id}
        value={value || ''}
        onChange={handleChange}
        className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      >
        <option value="">Select {label}</option>
        {options.map((opt, idx) => (
          <option key={idx} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );

  if (authLoading || initialDataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div>
        <div className="ml-4 text-lg text-gray-600">Loading profile...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg text-gray-600">You must be signed in to view your profile.</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Profile Photo Section */}
      <div className="flex flex-col items-center mb-8">
        <label htmlFor="upload-photo" className="cursor-pointer flex flex-col items-center">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200">
            <img
              src={photoUrl || '/default-avatar.png'}
              alt="Profile"
              className="object-cover w-full h-full"
            />
          </div>
          <div className="mt-2 text-blue-600 hover:underline">
            {photoUrl ? 'Change Photo' : 'Add Photo'}
          </div>
        </label>
        <input
          id="upload-photo"
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          className="hidden"
        />
        {uploadingPhoto && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
      </div>

      <h1 className="text-3xl font-bold mb-8 text-center text-slate-700">My Profile</h1>

      {message.text && (
        <div className={`p-4 mb-6 rounded-md text-sm ${
          message.type === 'error' ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-green-100 text-green-700 border border-green-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="bg-white shadow-xl rounded-xl p-6 md:p-8">
          <h2 className="text-2xl font-semibold mb-6 text-slate-600 border-b pb-4">Personal Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {renderDisplayField("First Name", user.first_name)}
            {renderDisplayField("Last Name", user.last_name)}
            {renderInputField("Preferred Name", "preferred_name", formData.preferred_name)}
            {renderDisplayField("Date of Birth", user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString() : "Not set")}
            {renderSelectField("Gender", "gender", formData.gender, GENDER_OPTIONS)}
            {renderInputField("Address Line 1", "address_line_1", formData.address_line_1, "md:col-span-2")}
            {renderInputField("Address Line 2", "address_line_2", formData.address_line_2, "md:col-span-2")}
            {renderInputField("City", "city", formData.city)}
            {renderInputField("Province", "province", formData.province)}
            {renderInputField("Country", "country", formData.country)}
            {renderInputField("Postal Code", "postal_code", formData.postal_code)}
            {renderInputField("Phone", "phone", formData.phone, "md:col-span-2")}
          </div>
        </section>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSubmitting || !hasUnsavedChanges}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;