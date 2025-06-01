import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchEmployees() {
      const { data, error } = await supabase
        .from('employees')
        .select('*');
      if (error) {
        console.error('Error fetching employees:', error);
        setError('Failed to fetch employees');
      } else {
        setEmployees(data);
      }
      setLoading(false);
    }
    fetchEmployees();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Employees</h1>
        <Link 
          to="/add-employee" 
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
        >
          Add Employee
        </Link>
      </div>
      {loading ? (
        <p>Loading employees...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : employees.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white shadow-md rounded-lg">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salary</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-700">{emp.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{emp.position}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{emp.department}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{emp.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{emp.phone || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{emp.salary ? `$${emp.salary}` : 'N/A'}</td>
                  <td className="px-6 py-4 text-center">
                    {/* Link to the edit page with employee ID */}
                    <Link
                      to={`/edit-employee/${emp.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {/* You can use an icon from a library like Heroicons or Font Awesome */}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M17.414 2.586a2 2 0 010 2.828l-1.793 1.793-2.828-2.828 1.793-1.793a2 2 0 012.828 0zM4 13.586V16h2.414l7.793-7.793-2.414-2.414L4 13.586z" />
                      </svg>
                      <span className="ml-1">Edit</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-600">No employees found.</p>
      )}
    </div>
  );
}
