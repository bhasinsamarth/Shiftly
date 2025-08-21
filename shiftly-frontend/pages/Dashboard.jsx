import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';



const Dashboard = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();



  const accessDenied = location.state?.accessDenied;
  const accessMessage = location.state?.message;

  // State to control the visibility of the access denied message
  const [showAccessDenied, setShowAccessDenied] = useState(!!accessDenied);

  // Auto-hide access denied message after 5 seconds
  useEffect(() => {
    if (accessDenied) {
      const timer = setTimeout(() => {
        setShowAccessDenied(false);
      }, 5000); // 5 seconds

      return () => clearTimeout(timer);
    }
  }, [accessDenied]);

  // --- ADMIN, OWNER DASHBOARD LOGIC ---
  const [employeesCount, setEmployeesCount] = useState(0);

  useEffect(() => {
    if (user && (user.role_id === 1 || user.role_id === 2)) {
      async function fetchMetricsAndActivity() {
        // Employee count from employee table
        const { data: empRows, error: countError } = await supabase
          .from('employee')
          .select('id');
        if (!countError && empRows) {
          setEmployeesCount(empRows.length);
        } else {
          console.error('Error fetching employee count:', countError);
        }
      }
      fetchMetricsAndActivity();
    }
  }, [user]);
  

  // --- EMPLOYEE DASHBOARD LOGIC ---
  const [myEmployee, setMyEmployee] = useState(null);
  const [loadingMyEmp, setLoadingMyEmp] = useState(true);
  const [errorMyEmp, setErrorMyEmp] = useState('');
  const [storeShifts, setStoreShifts] = useState([]);
  const [loadingStoreShifts, setLoadingStoreShifts] = useState(true);
  const [errorStoreShifts, setErrorStoreShifts] = useState('');

  useEffect(() => {
    async function fetchShiftsForWeek(employeeId, weekStart, weekEnd) {
      const { data: shiftData, error: shiftError } = await supabase
        .from('store_schedule')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('start_time', weekStart.toISOString())
        .lte('start_time', weekEnd.toISOString())
        .order('start_time', { ascending: true });
      return { shiftData, shiftError };
    }

    // Include role_id 3 (manager) in the schedule preview logic
    if (user && (user.role_id === 3 || user.role_id === 4 || user.role_id === 5 || user.role_id === 6) && myEmployee) {
      (async () => {
        try {
          if (!myEmployee.employee_id) {
            setErrorStoreShifts('No employee_id found for your account.');
            setLoadingStoreShifts(false);
            return;
          }
          // Calculate current week (Sunday to Saturday)
          const now = new Date();
          const day = now.getDay();
          const weekStart = new Date(now);
          weekStart.setHours(0,0,0,0);
          weekStart.setDate(now.getDate() - day);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23,59,59,999);

          // Try to fetch this week's shifts
          let { shiftData, shiftError } = await fetchShiftsForWeek(myEmployee.employee_id, weekStart, weekEnd);
          if (shiftError) {
            setErrorStoreShifts('Could not fetch schedule.');
            setLoadingStoreShifts(false);
            return;
          }
          // If no shifts, try next week
          if (!shiftData || shiftData.length === 0) {
            const nextWeekStart = new Date(weekStart);
            nextWeekStart.setDate(weekStart.getDate() + 7);
            const nextWeekEnd = new Date(nextWeekStart);
            nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
            nextWeekEnd.setHours(23,59,59,999);
            ({ shiftData, shiftError } = await fetchShiftsForWeek(myEmployee.employee_id, nextWeekStart, nextWeekEnd));
            if (shiftError) {
              setErrorStoreShifts('Could not fetch schedule.');
            } else {
              setStoreShifts(shiftData || []);
            }
          } else {
            setStoreShifts(shiftData || []);
          }
        } catch (err) {
          setErrorStoreShifts('Unexpected error fetching schedule.');
        }
        setLoadingStoreShifts(false);
      })();
    } else if (!myEmployee && (user && (user.role_id === 3 || user.role_id === 4 || user.role_id === 5 || user.role_id === 6))) {
      setLoadingStoreShifts(false); // Avoid infinite loading if employee lookup fails
    }
  }, [user, myEmployee]);


  useEffect(() => {
    if (user && (user.role_id === 3 || user.role_id === 4 || user.role_id === 5 || user.role_id === 6)) {
      async function fetchMyEmployee() {
        const { data, error } = await supabase
          .from('employee')
          .select('*')
          .eq('email', user.email)
          .single();
        if (error) {
          setErrorMyEmp('Could not fetch your employee data.');
        } else {
          setMyEmployee(data);
        }
        setLoadingMyEmp(false);
      }
      fetchMyEmployee();
    }
  }, [user]);


  // --- RENDERING ---
  if (user && (user.role_id === 1 || user.role_id === 2)) {
    // ADMIN AND OWNER dashboard
    return (
      <div className="max-w-full mx-auto p-2 sm:p-4 lg:p-6">
        {showAccessDenied && accessMessage && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 transition-opacity duration-500">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{accessMessage}</p>
              </div>
            </div>
          </div>
        )}

        <section className="">
          <h1 className="text-2xl font-bold mb-1 text-gray-800">Dashboard</h1>
          <p className="text-md text-gray-500 mb-6">Welcome back, Admin</p>

          {/* STAT CARDS */}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Link to="/employees">
              <div className="bg-white p-4 rounded-xl shadow-md">
                <p className="text-sm text-gray-500">Total Employees</p>
                <p className="text-2xl font-bold text-blue-700">{employeesCount}</p>
              </div>
            </Link>
            {/* To-do: Add logic for open positions  */}
            <div className="bg-white p-4 rounded-xl shadow-md">
              <p className="text-sm text-gray-500">Open Positions</p>
              <p className="text-2xl font-bold text-blue-700">5</p>
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
            <div className="flex flex-col md:flex-row gap-4">
              <Link to="/employees">
                <button className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl shadow transition">
                  Manage Employees
                </button>
              </Link>
              <Link to="/add-employee">
                <button className="flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-black font-semibold py-2 px-4 rounded-xl shadow transition">
                  Hire Employees
                </button>
              </Link>
            </div>
          </div>
        </section>
      </div>

    );
  } else if (user && user.role_id === 3) {
    // Manager dashboard
    if (loadingMyEmp) {
      return <div className="flex justify-center items-center h-screen"><p className="text-lg text-gray-500">Loading your dashboard...</p></div>;
    }
    if (errorMyEmp) {
      return <div className="p-4 text-red-600 bg-red-100 rounded-md">{errorMyEmp}</div>;
    }
    if (!myEmployee) {
      return <div className="p-4 text-gray-600 bg-gray-100 rounded-md">No employee data found for your account. Please contact support.</div>;
    }
    return (
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <section className="mb-4 py-5">
          <h1 className="text-2xl font-bold  mb-1">Dashboard</h1>
          <p className="text-md mt-4 text-gray-500 mb-1">Welcome back, {myEmployee.first_name} {myEmployee.last_name ? ` ${myEmployee.last_name}` : ''}</p>
        </section>
        {/* Quick Actions div */}
        <div>
          <div>
            <h2 className="text-xl  font-bold text-gray-800 mb-4">Quick Actions</h2>
          </div>
          <div className='flex flex-col md:flex-row gap-4 mb-6'>
            <Link to="/schedules">
              <button className='mb-4 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl shadow-sm transition'>
                Create Schedule
              </button>
            </Link>
            <Link to="/time-off">
              <button className='mb-4 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-black font-semibold py-2 px-4 rounded-xl shadow-sm transition'>
                Requests
              </button>
            </Link>
          </div>
        </div>
        {/* Upcoming div */}
        <div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Upcoming</h2>
          </div>
          <div className=" rounded-lg mb-6">
          </div>
          {/* My Schedule */}
          <Link to="/fetch-schedule" className="col-span-1  rounded-xl flex flex-col min-h-[200px] cursor-pointer">
            {(() => {
              const now = new Date();
              const upcomingShift = storeShifts
                .filter(sch => sch.start_time && new Date(sch.start_time) > now)
                .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];
              if (loadingStoreShifts) {
                return (
                  <div className="flex-1 overflow-y-auto text-gray-800 p-6" style={{ maxHeight: '200px' }}>
                    <p className="text-blue-700">Loading...</p>
                  </div>
                );
              } else if (errorStoreShifts) {
                return (
                  <div className="flex-1 overflow-y-auto text-gray-800 p-6" style={{ maxHeight: '200px' }}>
                    <p className="text-red-600">{errorStoreShifts}</p>
                  </div>
                );
              } else if (!upcomingShift) {
                return (
                  <div className="flex-1 overflow-y-auto text-gray-800 p-6" style={{ maxHeight: '200px' }}>
                    <p className="text-gray-500">You have nothing planned.</p>
                  </div>
                );
              } else {
                const shiftDate = new Date(upcomingShift.start_time);
                return (
                  <div className="flex-1 overflow-y-auto text-gray-800 " style={{ maxHeight: '200px' }}>
                    <h3 className="text-md text-gray-500 mb-2">
                      {shiftDate.toLocaleDateString('en-US', { weekday: 'long' })}, {shiftDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </h3>
                    <ul className="divide-y divide-gray-100">
                      <li className="py-1 flex items-center">
                        <div className=" flex-1">
                          <span className='font-bold'>Shift from </span>
                          <div className="text-xs sm:text-sm text-gray-700 font-semibold">
                            {upcomingShift.start_time && upcomingShift.end_time ? `${new Date(upcomingShift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to ${new Date(upcomingShift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No shift'}
                          </div>
                          <div className="text-xs text-gray-500">{upcomingShift.department || upcomingShift.location || ''}</div>
                        </div>
                      </li>
                    </ul>
                  </div>
                );
              }
            })()}
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-10">
        </div>
      </div>
    );
  } else if (user && (user.role_id === 4 || user.role_id === 5 || user.role_id === 6)) {
    // Full-time Associate, Part-time Associate, Interns dashboard
    if (loadingMyEmp) {
      return <div className="flex justify-center items-center h-screen"><p className="text-lg text-gray-500">Loading your dashboard...</p></div>;
    }
    if (errorMyEmp) {
      return <div className="p-4 text-red-600 bg-red-100 rounded-md">{errorMyEmp}</div>;
    }
    if (!myEmployee) {
      return <div className="p-4 text-gray-600 bg-gray-100 rounded-md">No employee data found for your account. Please contact support.</div>;
    }
    return (
      <div className="max-w-full mx-auto  px-4 sm:px-6 lg:px-8">
        <section className="mb-4 py-5">
          <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
          <p className="text-md  text-gray-500 mb-1">Welcome back, {myEmployee.first_name} {myEmployee.last_name ? ` ${myEmployee.last_name}` : ''}</p>
        </section>
        {/* Quick Actions div */}
        <div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">Quick Actions</h2>
          </div>
          <div className='flex flex-col md:flex-row gap-4 mb-6'>
            <Link to="/clock">
              <button className='mb-4 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl shadow-sm transition'>
                Clock in
              </button>
            </Link>

            <Link to="/fetch-schedule">

              <button className='mb-4 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-black font-semibold py-2 px-4 rounded-xl shadow-sm transition'>
                My Schedule
              </button>
            </Link>
          </div>
        </div>
        {/* Upcoming div */}
        <div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">Upcoming</h2>
          </div>
          <div className=" rounded-lg mb-6">
          </div>
          {/* My Schedule */}

          <Link to="/fetch-schedule" className="col-span-1  rounded-xl flex flex-col min-h-[200px] cursor-pointer">
            {(() => {
              const now = new Date();
              const upcomingShift = storeShifts
                .filter(sch => sch.start_time && new Date(sch.start_time) > now)
                .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];
              if (loadingStoreShifts) {
                return (
                  <div className="flex-1 overflow-y-auto text-gray-800 p-6" style={{ maxHeight: '200px' }}>
                    <p className="text-blue-700">Loading...</p>
                  </div>
                );
              } else if (errorStoreShifts) {
                return (
                  <div className="flex-1 overflow-y-auto text-gray-800 p-6" style={{ maxHeight: '200px' }}>
                    <p className="text-red-600">{errorStoreShifts}</p>
                  </div>
                );
              } else if (!upcomingShift) {
                return (
                  <div className="flex-1 overflow-y-auto text-gray-800 p-6" style={{ maxHeight: '200px' }}>
                    <p className="text-gray-500">You have nothing planned.</p>
                  </div>
                );
              } else {
                const shiftDate = new Date(upcomingShift.start_time);
                return (
                  <div className="flex-1 overflow-y-auto text-gray-800 " style={{ maxHeight: '200px' }}>
                    <h3 className="text-md text-gray-500 mb-2">
                      {shiftDate.toLocaleDateString('en-US', { weekday: 'long' })}, {shiftDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </h3>
                    <ul className="divide-y divide-gray-100">
                      <li className="py-1 flex items-center">
                        <div className=" flex-1">
                          <span className='font-bold'>Shift from </span>
                          <div className="text-xs sm:text-sm text-gray-700 font-semibold">
                            {upcomingShift.start_time && upcomingShift.end_time ? `${new Date(upcomingShift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to ${new Date(upcomingShift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No shift'}
                          </div>
                          <div className="text-xs text-gray-500">{upcomingShift.department || upcomingShift.location || ''}</div>
                        </div>
                      </li>
                    </ul>
                  </div>
                );
              }
            })()}
          </Link>
        </div>
      </div>
    );
  }
};

export default Dashboard;
