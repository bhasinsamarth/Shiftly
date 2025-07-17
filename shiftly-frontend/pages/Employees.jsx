import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchEmployees() {
      const { data, error } = await supabase
        .from('employee')
        .select(`
          *,
          role:role_id (
            role_desc
          )
        `);
      if (error) {
        console.error('Error fetching employees:', error);
        setError('Failed to fetch employees');
      } else {
        setEmployees(data);
        setFilteredEmployees(data);
      }
      setLoading(false);
    }
    fetchEmployees();
  }, []);

  useEffect(() => {
    const filtered = employees.filter(emp =>
      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredEmployees(filtered);
  }, [searchTerm, employees]);

  return (
    <div className="max-w-full mx-auto p-3 sm:p-4 lg:p-6">
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Employees</h1>
          <Link
            to="/add-employee"
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors text-center text-sm sm:text-base"
          >
            Add Employee
          </Link>
        </div>

        <input
          type="text"
          placeholder="Search by name or email..."
          className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>


      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm sm:text-base text-gray-600">Loading employees...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-500 text-sm sm:text-base">{error}</p>
        </div>
      ) : filteredEmployees.length > 0 ? (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase hidden sm:table-cell">Role</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase hidden md:table-cell">Email</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase hidden lg:table-cell">Phone</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase hidden lg:table-cell">Salary</th>
                    <th className="px-3 sm:px-6 py-3 text-center text-xs sm:text-sm font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-700">
                        <div className="min-w-0">
                          <div className="font-semibold">{emp.first_name} {emp.last_name}</div>
                          {/* Show position on mobile when position column is hidden */}
                          <div className="sm:hidden text-xs text-gray-500 truncate mt-1">
                            <span className="font-medium">Role:</span> {emp.role?.role_desc || 'No role'}
                          </div>
                          {/* Show email and contact info on mobile when those columns are hidden */}
                          <div className="md:hidden text-xs text-gray-400 mt-1 space-y-1">
                            {emp.email && (
                              <div className="break-words"><span className="font-medium">Email:</span> <span className="break-all">{emp.email}</span></div>
                            )}
                            <div className="lg:hidden text-xs text-gray-400 space-y-1">
                              {emp.phone && (
                                <div className="truncate"><span className="font-medium">Phone:</span> {emp.phone}</div>
                              )}
                              {emp.salary && (
                                <div className="truncate"><span className="font-medium">Salary:</span> ${emp.salary}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-700 hidden sm:table-cell">
                        {emp.role?.role_desc || 'N/A'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-700 hidden md:table-cell">
                        <div className="max-w-xs truncate">
                          {emp.email || 'N/A'}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-700 hidden lg:table-cell">
                        {emp.phone || 'N/A'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-gray-700 hidden lg:table-cell">
                        {emp.salary ? `$${emp.salary}` : 'N/A'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-center">
                        <Link
                          to={`/edit-employee/${emp.id}`}
                          className="inline-flex items-center text-gray-600 hover:text-blue-600 transition-colors p-1 rounded"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="1"/>
                            <circle cx="12" cy="5" r="1"/>
                            <circle cx="12" cy="19" r="1"/>
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 sm:p-8 text-center">
          <p className="text-gray-600 text-sm sm:text-base">No employees found.</p>
        </div>
      )}
    </div>
  );
}
