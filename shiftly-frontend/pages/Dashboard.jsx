import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { submitEmployeeRequest, fetchPendingTimeOffCount } from '../utils/requestHandler';
import TimeOffRequestForm from '../components/TimeOffRequestForm';
import FetchSchedule from './FetchSchedule';

// Helper component for dashboard cards (admin/manager view)
const DashboardCard = ({ title, value, icon, bgColor, path }) => (
  <div className={`${bgColor} rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow min-h-[200px]`}>
    <div className="flex justify-between items-start">
      <div>
        <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
      </div>
      <div className="text-3xl">{icon}</div>
    </div>
  </div>
);

// Helper component for quick action links (admin/manager view)
const QuickAction = ({ icon, title, path }) => (
  <a
    href={path}
    className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-gray-50 transition-colors text-center"
  >
    <span className="text-2xl mb-2">{icon}</span>
    <span className="text-sm font-medium text-gray-700">{title}</span>
  </a>
);

const Dashboard = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  // Get username from context or fallback to localStorage
  let username = user?.username || 'User';
  try {
    if (!user) {
      const storedUser = JSON.parse(localStorage.getItem('staffeasy_user'));
      if (storedUser) {
        username = storedUser.username || storedUser.email || 'User';
      }
    }
  } catch (e) {
    console.error('Error parsing stored user', e);
  }

  // Get preferred name or first name for greeting
  let greetingName = user?.preferred_name || user?.first_name || username;

  const accessDenied = location.state?.accessDenied;
  const accessMessage = location.state?.message;

  // --- ADMIN, OWNER DASHBOARD LOGIC ---
  const [employeesCount, setEmployeesCount] = useState(0);
  const [teamsCount, setTeamsCount] = useState(0);
  const [pendingTimeOff, setPendingTimeOff] = useState(0);
  const [totalPayroll, setTotalPayroll] = useState(0);
  const [activity, setActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [errorActivity, setErrorActivity] = useState('');

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

        // Total payroll
        const { data: empSalaries, error: salaryError } = await supabase
          .from('employee')
          .select('pay_rate');
        if (!salaryError && empSalaries) {
          const total = empSalaries.reduce((acc, cur) => acc + Number(cur.salary || 0), 0);
          setTotalPayroll(total);
        } else {
          console.error('Error fetching salaries:', salaryError);
        }
        //ADMIN
        // Teams count: Always fetch number of rows from the store table
        const { data: storeRows, error: storeError } = await supabase
          .from('store')
          .select('store_id');
        if (!storeError && storeRows) {
          setTeamsCount(storeRows.length);
        } else {
          console.error('Error fetching store rows:', storeError);
        }

        // Pending time-off requests from time_off_requests table
        const count = await fetchPendingTimeOffCount();
        setPendingTimeOff(count);

        //       // Recent activity from "activity" table (excluding time-off request updates)
        // const { data: actData, error: actError } = await supabase
        //   .from('activity')
        //   .select('*')
        //   .order('timestamp', { ascending: false })
        //   .limit(5);
        // if (actError) {
        //   console.error('Error fetching activity:', actError);
        //   setErrorActivity('Failed to load recent activity');
        // } else {
        //   const filteredActivity = actData.filter(act => act.type !== 'Time-off Request');
        //   setActivity(filteredActivity);
        // }
        setLoadingActivity(false);
      }
      fetchMetricsAndActivity();
    }
  }, [user]);
  

  // --- EMPLOYEE DASHBOARD LOGIC ---

  const [myEmployee, setMyEmployee] = useState(null);
  const [loadingMyEmp, setLoadingMyEmp] = useState(true);
  const [errorMyEmp, setErrorMyEmp] = useState('');
  const [alertMsg, setAlertMsg] = useState(null);

  // New state for time-off request modal
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  // New state for user teams grouping: an object where keys are team names and values are arrays of members
  const [userTeamGroups, setUserTeamGroups] = useState({});
  // New state for open/closed dropdown for user teams
  const [openUserTeams, setOpenUserTeams] = useState({});

  // --- SCHEDULES SECTION ---
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [errorSchedules, setErrorSchedules] = useState('');
  // --- STORE SCHEDULE PREVIEW FOR DASHBOARD ---
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

  // --- TIME CARDS SECTION ---
  // (Commented out all timecard queries and related logic
  /*
    const [timeCards, setTimeCards] = useState([]);
    const [loadingTimeCards, setLoadingTimeCards] = useState(true);
    const [errorTimeCards, setErrorTimeCards] = useState('');
  
    useEffect(() => {
      async function fetchTimeCards() {
        const { data, error } = await supabase
          .from('timecards')
          .select('*')
          .eq('employee_id', myEmployee.employee_id)
          .order('clock_in', { ascending: false });
        if (error) setErrorTimeCards('Could not fetch time cards.');
        else setTimeCards(data || []);
        setLoadingTimeCards(false);
      }
      if (myEmployee) fetchTimeCards();
    }, [myEmployee]);
  */

  // --- CLOCK IN/OUT SECTION ---
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockMsg, setClockMsg] = useState('');

  // --- AVAILABILITY REQUEST SECTION ---
  const [showAvailModal, setShowAvailModal] = useState(false);
  const [availDays, setAvailDays] = useState([]);
  const [availTimes, setAvailTimes] = useState('');
  const [availMsg, setAvailMsg] = useState('');

  // --- ANONYMOUS COMPLAINT SECTION ---
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintAgainst, setComplaintAgainst] = useState('');
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintDetails, setComplaintDetails] = useState('');
  const [complaintName, setComplaintName] = useState('');
  const [complaintMsg, setComplaintMsg] = useState('');

  useEffect(() => {
    if (user && (user.role_id === 4 || user.role_id === 5 || user.role_id === 6)) {
      async function fetchMyEmployee() {
        const { data, error } = await supabase
          .from('employee') // FIX: use 'employee' (singular)
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

  // --- MANAGER (role_id 3) DASHBOARD LOGIC ---
  // THIS IS TO FETCH EMPLOYEE DATA
  useEffect(() => {
    if (user && user.role_id === 3) {
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

  // After myEmployee is fetched, load all teams that the employee is a part of
  useEffect(() => {
    if (myEmployee) {
      async function fetchUserTeams() {
        try {
          // Fetch the store_id(s) associated with the employee
          const { data: employeeStores, error: employeeError } = await supabase
              .from("employee")
              .select("store_id")
              .eq("id", myEmployee.id);

          if (employeeError || !employeeStores) {
              setAlertMsg({ type: 'error', text: 'Failed to load your stores.' });
              return;
          }

          // Extract unique store_ids
          const storeIds = employeeStores.map(store => store.store_id);

          // Fetch store details for the associated store_ids
          const { data: stores, error: storeError } = await supabase
              .from("store")
              .select("*")
              .in("store_id", storeIds);

          if (storeError || !stores) {
              setAlertMsg({ type: 'error', text: 'Failed to load store details.' });
              return;
          }

          // Group stores by store_name
          const groups = stores.reduce((acc, store) => {
              acc[store.store_name] = acc[store.store_name] || [];
              acc[store.store_name].push(store);
              return acc;
          }, {});

          setUserTeamGroups(groups);

          // Initialize open/closed state for each store as closed (false)
          const openStates = Object.keys(groups).reduce((acc, storeName) => {
              acc[storeName] = false;
              return acc;
          }, {});

          setOpenUserTeams(openStates);
        } catch (err) {
          console.error("Unexpected error fetching user teams:", err);
          setAlertMsg({ type: 'error', text: 'An unexpected error occurred.' });
        }
      }
      fetchUserTeams();
    }
  }, [myEmployee]);

  // Helper to get role description from role_id
  /*
  const getRoleDesc = (role_id) => {
    switch (role_id) {
      case 1: return 'Owner';
      case 2: return 'Manager';
      case 3: return 'Full-time Associate';
      case 4: return 'Part-time Associate';
      case 5: return 'Interns';
      default: return 'Unknown';
    }
  };
  */

  // Toggle dropdown for a specific team group
  /*
  const toggleUserTeamGroup = (teamName) => {
    setOpenUserTeams((prev) => ({
      ...prev,
      [teamName]: !prev[teamName],
    }));
  };
  */

  // Open the time-off request modal for a specific team (from the user's teams section)
  // This modal appears in the profile section only (as requested, Request Time Off remains in profile)
  const handleOpenTimeOffModal = () => {
    setShowTimeOffModal(true);
  };

  // Withdraw a time-off request for a normal user (global withdrawal)
  /*
  const handleWithdrawTimeOff = async () => {
    if (!myEmployee) return;
    const { error } = await supabase
      .from('time_off_requests')
      .update({ timeoff_requested: false })
      .eq('employee_id', myEmployee.id);
    if (error) {
      setAlertMsg({ type: 'error', text: 'Failed to withdraw time off request.' });
    } else {
      setAlertMsg({ type: 'success', text: 'Time off request withdrawn successfully.' });
      setMyEmployee({ ...myEmployee, timeoff_request: false });
    }
  };
  */

  // --- EFFECTS FOR NORMAL USER DASHBOARD LOGIC ---
  useEffect(() => {
    if (user && (user.role_id === 4 || user.role_id === 5 || user.role_id === 6)) {
      async function fetchSchedules() {
        // Fetch upcoming and past schedules for the employee
        const { data, error } = await supabase
          .from('schedules')
          .select('*')
          .eq('employee_id', user.id)
          .order('shift_start', { ascending: false });
        if (error) setErrorSchedules('Could not fetch schedules.');
        else setSchedules(data || []);
        setLoadingSchedules(false);
      }
      fetchSchedules();
    }
  }, [user]);

  useEffect(() => {
    if (user && (user.role_id === 4 || user.role_id === 5 || user.role_id === 6)) {
      async function fetchTimeCards() {
        // Fetch time cards for current and previous pay periods
        const { data, error } = await supabase
          .from('timecards')
          .select('*')
          .eq('employee_id', user.id)
          .order('date', { ascending: false });
        if (error) setErrorTimeCards('Could not fetch time cards.');
        else setTimeCards(data || []);
        setLoadingTimeCards(false);
      }
      fetchTimeCards();
    }
  }, [user]);

  useEffect(() => {
    if (user && (user.role_id === 4 || user.role_id === 5 || user.role_id === 6)) {
      async function checkClockStatus() {
        // Check if the user is currently clocked in
        const { data, error } = await supabase
          .from('timecards')
          .select('*')
          .eq('employee_id', user.id)
          .order('date', { ascending: false })
          .limit(1);
        if (!error && data && data[0]) {
          setIsClockedIn(!!data[0].clock_in && !data[0].clock_out);
        }
      }
      checkClockStatus();
    }
  }, [user]);

  // --- HANDLERS FOR CLOCK IN/OUT SECTION ---
  const handleClockIn = async () => {
    if (isClockedIn) {
      setClockMsg('Already clocked in.');
      return;
    }
    // Optionally, check for late/early logic here
    const now = new Date();
    // ...fetch scheduled shift and compare times for late/early...
    await supabase.from('timecards').insert([
      { employee_id: user.id, clock_in: now.toISOString(), date: now.toISOString().split('T')[0] }
    ]);
    setIsClockedIn(true);
    setClockMsg('Clocked in successfully.');
  };

  const handleClockOut = async () => {
    if (!isClockedIn) {
      setClockMsg('Not clocked in.');
      return;
    }
    const now = new Date();
    // Find today's timecard
    const { data } = await supabase
      .from('timecards')
      .select('*')
      .eq('employee_id', user.id)
      .eq('date', now.toISOString().split('T')[0])
      .order('clock_in', { ascending: false })
      .limit(1);
    if (data && data[0]) {
      await supabase
        .from('timecards')
        .update({ clock_out: now.toISOString() })
        .eq('id', data[0].id);
      setIsClockedIn(false);
      setClockMsg('Clocked out successfully.');
    }
  };

  // --- ANONYMOUS COMPLAINT HANDLER ---
  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    // Store complaint anonymously
    const { error } = await supabase.from('complaints').insert([
      {
        against: complaintAgainst,
        subject: complaintSubject,
        details: complaintDetails,
        name: complaintName || null,
        employee_id: user.id,
        anonymous: !complaintName
      }
    ]);
    if (error) setComplaintMsg('Failed to submit complaint.');
    else setComplaintMsg('Complaint submitted.');
    setShowComplaintModal(false);
  };

  // --- RENDERING ---
  if (user && (user.role_id === 1 || user.role_id === 2)) {
    // ADMIN AND OWNER dashboard
    return (
      <div className="max-w-6xl mx-auto p-2 sm:p-4 lg:p-6">
        {accessDenied && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="..." clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{accessMessage || 'You do not have permission to access the requested page.'}</p>
              </div>
            </div>
          </div>
        )}

        <section className="py-5">
          <h1 className="text-3xl font-bold mb-1 text-gray-800">Dashboard</h1>
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
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Quick Actions</h2>
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

          {/* RECENT HIRES */}
          {/* placeholder, Still  have to write the logic for recent hires */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Hires</h2>
            <ul className="bg-white rounded-lg shadow divide-y divide-gray-100">
              {[{ name: 'Emily Zhang', role: 'Physiotherapist' }, { name: 'Jordan Blake', role: 'Front Desk' }].map((emp, idx) => (
                <li key={idx} className="px-4 py-3 flex justify-between text-sm">
                  <span>{emp.name}</span>
                  <span className="text-gray-500">{emp.role}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ACTIVITY FEED */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Activity</h2>
            {loadingActivity ? (
              <p className="text-gray-600">Loading recent activity...</p>
            ) : errorActivity ? (
              <p className="text-red-500">{errorActivity}</p>
            ) : activity.length > 0 ? (
              <div className="bg-white rounded-lg shadow-md overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Type', 'Action', 'Details', 'When', 'By'].map((col) => (
                        <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activity.map(act => (
                      <tr key={act.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm text-gray-900">{act.type}</td>
                        <td className="px-4 py-4 text-sm text-gray-500">{act.action}</td>
                        <td className="px-4 py-4 text-sm text-gray-900">{act.subject}</td>
                        <td className="px-4 py-4 text-sm text-gray-500">{new Date(act.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-4 text-sm text-gray-500">{act.user_name || act.user_email || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600 bg-gray-50 p-3 rounded-md">No recent activity found.</p>
            )}
          </section>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <section className="mb-4 py-5">
          <h1 className="text-2xl md:text-3xl font-bold  mb-1">Dashboard</h1>
          <p className="text-md mt-4 text-gray-500 mb-1">Welcome back, {myEmployee.first_name} {myEmployee.last_name ? ` ${myEmployee.last_name}` : ''}</p>
        </section>
        {/* Quick Actions div */}
        <div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">Quick Actions</h2>
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
        {/* recent activity */}
        <div className="mt-10">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Activity</h2>
          <div className="bg-white rounded-xl shadow-md p-6">
            {loadingActivity ? (
              <p className="text-gray-600">Loading recent activity...</p>
            ) : errorActivity ? (
              <p className="text-red-500">{errorActivity}</p>
            ) : activity.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {activity.map((act, idx) => (
                  <li key={act.id || idx} className="flex items-start py-4 gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {/* Icon based on activity type */}
                      {act.type === 'Time-off Request' ? (
                        <span className="inline-block bg-gray-100 rounded-full p-2 text-gray-500">
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </span>
                      ) : act.type === 'Schedule' ? (
                        <span className="inline-block bg-gray-100 rounded-full p-2 text-gray-500">
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </span>
                      ) : (
                        <span className="inline-block bg-gray-100 rounded-full p-2 text-gray-500">
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0h6" /></svg>
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm mb-1">{act.action || act.type}</div>
                      <div className="text-gray-500 text-xs mb-1">{act.subject}</div>
                      <div className="text-gray-400 text-xs">{act.timestamp ? new Date(act.timestamp).toLocaleString() : ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600 bg-gray-50 p-3 rounded-md">No recent activity found.</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-10">

          {/* Complaint Modal */}
          {showComplaintModal && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8 w-full max-w-md">
                <form onSubmit={handleSubmitComplaint}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">Against (Name or Role)</label>
                    <input type="text" value={complaintAgainst} onChange={e => setComplaintAgainst(e.target.value)} required className="mt-1 block w-full rounded-md border border-gray-300" />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">Subject</label>
                    <input type="text" value={complaintSubject} onChange={e => setComplaintSubject(e.target.value)} required className="mt-1 block w-full rounded-md border border-gray-300" />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">Details</label>
                    <textarea value={complaintDetails} onChange={e => setComplaintDetails(e.target.value)} required className="mt-1 block w-full rounded-md border border-gray-300" rows="4" />
                  </div>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700">Your Name (optional)</label>
                    <input type="text" value={complaintName} onChange={e => setComplaintName(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300" />
                  </div>
                  <div className="flex justify-end space-x-4">
                    <button type="submit" className="px-5 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition">Submit</button>
                    <button type="button" onClick={() => setShowComplaintModal(false)} className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
        {/* End Complaint Modal */}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <section className="mb-4 py-5">
          <h1 className="text-2xl md:text-3xl font-bold  mb-1">Dashboard</h1>
          <p className="text-md mt-4 text-gray-500 mb-1">Welcome back, {myEmployee.first_name} {myEmployee.last_name ? ` ${myEmployee.last_name}` : ''}</p>
        </section>
        {/* Quick Actions div */}
        <div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">Quick Actions</h2>
          </div>
          <div className='flex flex-col md:flex-row gap-4 mb-6'>
            <Link to="/">
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
        {/* Complaint Modal */}
        {showComplaintModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8 w-full max-w-md">
              <form onSubmit={handleSubmitComplaint}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Against (Name or Role)</label>
                  <input type="text" value={complaintAgainst} onChange={e => setComplaintAgainst(e.target.value)} required className="mt-1 block w-full rounded-md border border-gray-300" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Subject</label>
                  <input type="text" value={complaintSubject} onChange={e => setComplaintSubject(e.target.value)} required className="mt-1 block w-full rounded-md border border-gray-300" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Details</label>
                  <textarea value={complaintDetails} onChange={e => setComplaintDetails(e.target.value)} required className="mt-1 block w-full rounded-md border border-gray-300" rows="4" />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700">Your Name (optional)</label>
                  <input type="text" value={complaintName} onChange={e => setComplaintName(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300" />
                </div>
                <div className="flex justify-end space-x-4">
                  <button type="submit" className="px-5 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition">Submit</button>
                  <button type="button" onClick={() => setShowComplaintModal(false)} className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }
};

export default Dashboard;
