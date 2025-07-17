import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import DropdownMenu from '../components/DropdownMenu';

const EditEmployee = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    preferred_name: '',
    email: '',
    phone: '',
    pay_rate: '',
    role_id: '',
    store_id: '',
  });

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch employee data
        const { data: employeeData, error: employeeError } = await supabase
          .from('employee')
          .select('*')
          .eq('id', id)
          .single();
          
        if (employeeError) {
          console.error('Error fetching employee:', employeeError);
          setError('Failed to load employee data.');
          setLoading(false);
          return;
        }
        
        // Set employee data to form
        setEmployee(employeeData);
        setForm({
          first_name: employeeData.first_name || '',
          last_name: employeeData.last_name || '',
          preferred_name: employeeData.preferred_name || '',
          email: employeeData.email || '',
          phone: employeeData.phone || '',
          pay_rate: employeeData.pay_rate || '',
          role_id: employeeData.role_id || '',
          store_id: employeeData.store_id || '',
        });
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('An error occurred while loading data');
        setLoading(false);
      }
    }
    
    fetchData();
  }, [id]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!form.first_name || !form.email || !form.role_id) {
      setError('Please fill in all required fields.');
      return;
    }
    
    setError('');
    setSuccess('');
    setSubmitting(true);
    
    try {
      const { data, error } = await supabase
        .from('employee')
        .update({
          first_name: form.first_name,
          last_name: form.last_name,
          preferred_name: form.preferred_name,
          email: form.email,
          phone: form.phone,
          pay_rate: form.pay_rate ? Number(form.pay_rate) : null,
          role_id: form.role_id ? Number(form.role_id) : null,
          store_id: form.store_id ? Number(form.store_id) : null,
        })
        .eq('id', id);
        
      if (error) {
        console.error('Error updating employee:', error);
        setError('Failed to update employee: ' + error.message);
      } else {
        setSuccess('Employee updated successfully!');
        // Navigate after short delay to show success message
        setTimeout(() => navigate('/employees'), 1500);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-3"></div>
      <p className="text-gray-600">Loading employee data...</p>
    </div>
  );
  
  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-lg w-full">
        <h3 className="text-xl font-semibold text-red-700 mb-2">Error</h3>
        <p className="text-red-600">{error}</p>
        <button 
          onClick={() => navigate('/employees')}
          className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
        >
          Back to Employees
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 py-8">
      <div className="w-full max-w-lg bg-white shadow-lg rounded-lg p-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Edit Employee</h1>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
          >
            Back
          </button>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <p className="font-medium">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            <p className="font-medium">{success}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="first_name" className="block text-gray-700 font-medium mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="last_name" className="block text-gray-700 font-medium mb-2">
                Last Name
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label htmlFor="preferred_name" className="block text-gray-700 font-medium mb-2">
              Preferred Name
            </label>
            <input
              type="text"
              id="preferred_name"
              name="preferred_name"
              value={form.preferred_name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-gray-700 font-medium mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-gray-700 font-medium mb-2">Phone</label>
            <input
              type="text"
              id="phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="pay_rate" className="block text-gray-700 font-medium mb-2">
              Pay Rate ($/hr)
            </label>
            <input
              type="number"
              id="pay_rate"
              name="pay_rate"
              value={form.pay_rate}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
              step="0.01"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <DropdownMenu
                label="Role"
                name="role_id"
                value={form.role_id}
                onChange={handleChange}
                tableName="role"
                valueField="role_id"
                displayField="role_desc"
                placeholder="Select role"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={true}
              />
            </div>
            <div>
              <DropdownMenu
                label="Store"
                name="store_id"
                value={form.store_id}
                onChange={handleChange}
                tableName="store"
                valueField="store_id"
                displayField="store_name"
                placeholder="Select store"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                <span>Updating...</span>
              </div>
            ) : 'Update Employee'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditEmployee;
