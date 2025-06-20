import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { submitEmployeeRequest, fetchPendingTimeOffCount } from '../utils/requestHandler';
import TimeOffRequestForm from '../components/TimeOffRequestForm';

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

    if (user && (user.role_id === 4 || user.role_id === 5 || user.role_id === 6) && myEmployee) {
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
    } else if (!myEmployee && (user && (user.role_id === 4 || user.role_id === 5 || user.role_id === 6))) {
      setLoadingStoreShifts(false); // Avoid infinite loading if employee lookup fails
    }
  }, [user, myEmployee]);

  // --- TIME CARDS SECTION ---
  const [timeCards, setTimeCards] = useState([]);
  const [loadingTimeCards, setLoadingTimeCards] = useState(true);
  const [errorTimeCards, setErrorTimeCards] = useState('');

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
    const dynamicDashboardCards = [
      { title: 'Employees', value: employeesCount, icon: '👥', bgColor: 'bg-blue-50', path: '/employees' },
      { title: 'Teams', value: teamsCount, icon: '🏢', bgColor: 'bg-green-50', path: '/teams' },
      { title: 'Employee Requests', value: pendingTimeOff, icon: '📋', bgColor: 'bg-yellow-50', path: '/employee-requests' },
      { title: 'Payroll', value: totalPayroll ? `$${totalPayroll.toLocaleString()}` : '$0', icon: '💰', bgColor: 'bg-purple-50', path: '/payroll' },
    ];

    return (
      <div className="max-w-6xl mx-auto p-2 sm:p-4 lg:p-6">
        {accessDenied && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4"> {/* Reduced margin above welcome */}
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{accessMessage || 'You do not have permission to access the requested page.'}</p>
              </div>
            </div>
          </div>
        )}
        <section className="mb-4 bg-blue-700 rounded-xl px-6 py-5">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Welcome {greetingName}</h1>
        </section>
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          {dynamicDashboardCards.map((card, index) => (
            <DashboardCard key={index} {...card} />
          ))}
        </section>
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <QuickAction icon="👤" title="Add Employee" path="/add-employee" />
            <QuickAction icon="👥" title="Manage Employees" path="/employees" />
            <QuickAction icon="🗂️" title="Manage Teams" path="/teams" />
            <QuickAction icon="📋" title="Review Time-off" path="/time-off" />
          </div>
        </section>
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
                    <th className="px-2 py-3 sm:px-4 lg:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Type</th>
                    <th className="px-2 py-3 sm:px-4 lg:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Action</th>
                    <th className="px-2 py-3 sm:px-4 lg:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Details</th>
                    <th className="px-2 py-3 sm:px-4 lg:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">When</th>
                    <th className="px-2 py-3 sm:px-4 lg:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">By</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activity.map(act => (
                    <tr key={act.id} className="hover:bg-gray-50">
                      <td className="px-2 py-4 sm:px-4 lg:px-6 whitespace-nowrap text-sm text-gray-900">{act.type}</td>
                      <td className="px-2 py-4 sm:px-4 lg:px-6 whitespace-nowrap text-sm text-gray-500">{act.action}</td>
                      <td className="px-2 py-4 sm:px-4 lg:px-6 whitespace-nowrap text-sm text-gray-900">{act.subject}</td>
                      <td className="px-2 py-4 sm:px-4 lg:px-6 whitespace-nowrap text-sm text-gray-500">{new Date(act.timestamp).toLocaleString()}</td>
                      <td className="px-2 py-4 sm:px-4 lg:px-6 whitespace-nowrap text-sm text-gray-500">{act.user_name || act.user_email || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600 bg-gray-50 p-3 rounded-md">No recent activity found.</p>
          )}
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
      <div className="container mx-auto p-2 sm:p-4 lg:p-6">
        <section className="mb-4 bg-blue-700 rounded-xl px-6 py-5">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Welcome {myEmployee.first_name} {myEmployee.last_name ? ` ${myEmployee.last_name}` : ''}</h1>
        </section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-white rounded-xl shadow-md flex flex-col border border-gray-200 col-span-1 min-h-[200px] group hover:shadow-xl transition-shadow duration-300">
            <div className="transition-colors duration-300 rounded-t-xl px-6 pt-6 pb-4 group-hover:bg-green-700">
              <h3 className="text-lg font-semibold text-gray-800 mb-0 group-hover:text-white transition">My Store</h3>
            </div>
            <div className="flex-1 p-6">
              <p className="text-gray-700">View and manage your assigned store(s), see store details, and access store-specific actions.</p>
              <a href="/teams" className="mt-3 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">Go to My Store</a>
            </div>
          </div>
          {/* Schedule Planner */}
          <div className="bg-white rounded-xl shadow-md flex flex-col border border-gray-200 col-span-1 min-h-[200px] group hover:shadow-xl transition-shadow duration-300">
            <div className="transition-colors duration-300 rounded-t-xl px-6 pt-6 pb-4 group-hover:bg-yellow-700">
              <h3 className="text-lg font-semibold text-gray-800 mb-0 group-hover:text-white transition">Schedule Planner</h3>
            </div>
            <div className="flex-1 p-6">
              <p className="text-gray-700">Plan, view, and edit employee schedules. Assign shifts and manage coverage.</p>
              <a href="/schedules" className="mt-3 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">Open Schedule Planner</a>
            </div>
          </div>
          {/* Team Management */}
          <div className="bg-white rounded-xl shadow-md flex flex-col border border-gray-200 col-span-1 min-h-[200px] group hover:shadow-xl transition-shadow duration-300">
            <div className="transition-colors duration-300 rounded-t-xl px-6 pt-6 pb-4 group-hover:bg-purple-700">
              <h3 className="text-lg font-semibold text-gray-800 mb-0 group-hover:text-white transition">Team Management</h3>
            </div>
            <div className="flex-1 p-6">
              <p className="text-gray-700">View your team, manage members, and assign roles or responsibilities.</p>
              <a href="/teams" className="mt-3 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">Manage Teams</a>
            </div>
          </div>
          {/* Employee Requests */}
          <div className="bg-white rounded-xl shadow-md flex flex-col border border-gray-200 col-span-1 min-h-[200px] group hover:shadow-xl transition-shadow duration-300">
            <div className="transition-colors duration-300 rounded-t-xl px-6 pt-6 pb-4 group-hover:bg-pink-700">
              <h3 className="text-lg font-semibold text-gray-800 mb-0 group-hover:text-white transition">Employee Requests</h3>
            </div>
            <div className="flex-1 p-6">
              <p className="text-gray-700">Review, approve, or deny employee requests, including time-off requests.</p>
              <a href="/employee-requests" className="mt-3 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">Review Requests</a>
            </div>
          </div>
          {/* Notifications */}
          <div className="bg-white rounded-xl shadow-md flex flex-col border border-gray-200 col-span-1 min-h-[200px] group hover:shadow-xl transition-shadow duration-300">
            <div className="transition-colors duration-300 rounded-t-xl px-6 pt-6 pb-4 group-hover:bg-blue-700">
              <h3 className="text-lg font-semibold text-gray-800 mb-0 group-hover:text-white transition">Notifications</h3>
            </div>
            <ul className="divide-y divide-gray-100 p-6 flex-1 overflow-y-auto" style={{ maxHeight: '200px' }}>
              <li className="py-2 flex justify-between text-xs sm:text-sm"><span>Pending Requests</span><span className="font-bold">0</span></li>
              <li className="py-2 flex justify-between text-xs sm:text-sm"><span>Shift Changes</span><span className="font-bold">0</span></li>
              <li className="py-2 flex justify-between text-xs sm:text-sm"><span>System Alerts</span><span className="font-bold">0</span></li>
              <li className="py-2 flex justify-between text-xs sm:text-sm"><span>Announcements</span><span className="font-bold">0</span></li>
            </ul>
          </div>
          {/* Reports & Analytics */}
          <div className="bg-white rounded-xl shadow-md flex flex-col border border-gray-200 col-span-1 min-h-[200px] group hover:shadow-xl transition-shadow duration-300">
            <div className="transition-colors duration-300 rounded-t-xl px-6 pt-6 pb-4 group-hover:bg-indigo-700">
              <h3 className="text-lg font-semibold text-gray-800 mb-0 group-hover:text-white transition">Reports & Analytics</h3>
            </div>
            <div className="flex-1 p-6">
              <p className="text-gray-700">View attendance, hours worked, and other key metrics for your team.</p>
              <a href="/reports" className="mt-3 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">View Reports</a>
            </div>
          </div>
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
      <div className="container mx-auto p-2 sm:p-4 lg:p-6">
        <section className="mb-4 bg-blue-700 rounded-xl px-6 py-5">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Welcome {myEmployee.first_name}{myEmployee.last_name ? ` ${myEmployee.last_name}` : ''}</h1>
        </section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {/* My Schedule */}
          <Link to="/FetchSchedule" className="col-span-1 bg-white rounded-xl shadow-md flex flex-col border border-gray-200 min-h-[200px] cursor-pointer">
              <div className="bg-blue-700 rounded-t-xl px-6 pt-6 pb-4">
                <h3 className="text-lg font-semibold text-white mb-0">My Schedule</h3>
              </div>
              <div className="flex-1 overflow-y-auto text-gray-800 p-6" style={{ maxHeight: '200px' }}>
                {loadingStoreShifts ? (
                  <p className="text-blue-700">Loading...</p>
                ) : errorStoreShifts ? (
                  <p className="text-red-600">{errorStoreShifts}</p>
                ) : storeShifts.length === 0 ? (
                  <p className="text-gray-500">You have nothing planned.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {storeShifts.slice(0, 5).map((sch, idx) => (
                      <li key={sch.id || idx} className="py-2 flex items-center">
                        <div className="w-10 sm:w-12 text-center">
                          <span className="block text-xs text-gray-400 font-medium">{sch.start_time ? new Date(sch.start_time).toLocaleDateString('en-US', { weekday: 'short' }) : '--'}</span>
                          <span className="block text-md sm:text-lg font-bold text-gray-700">{sch.start_time ? new Date(sch.start_time).getDate() : '--'}</span>
                        </div>
                        <div className="ml-2 sm:ml-3 flex-1">
                          <div className="text-xs sm:text-sm text-gray-700 font-medium">{sch.start_time && sch.end_time ? `${new Date(sch.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(sch.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No shift'}</div>
                          <div className="text-xs text-gray-500">{sch.department || sch.location || ''}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
          </Link>
          {/* My Timecard */}
          <div className="bg-white rounded-xl shadow-md flex flex-col border border-gray-200 col-span-1 min-h-[200px]">
            <div className="bg-blue-700 rounded-t-xl px-6 pt-6 pb-4">
              <h3 className="text-lg font-semibold text-white mb-0">My Timecard</h3>
            </div>
            <div className="flex flex-col items-center space-y-3 p-4">
              <button onClick={handleClockIn} disabled={isClockedIn} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 w-full">Clock In/Clock Out</button>
            </div>
            {timeCards.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6">
                <span className="text-sm">No data to display.</span>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {timeCards.slice(0, 5).map((tc, idx) => (
                  <li key={tc.id || idx} className="py-2">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="font-medium text-gray-700">{tc.date}</span>
                      <span className="text-gray-500">{tc.clock_in ? `${new Date(tc.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '--'} - {tc.clock_out ? `${new Date(tc.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '--'}</span>
                    </div>
                    <div className="text-xs text-gray-500">Hours: {tc.clock_in && tc.clock_out ? ((new Date(tc.clock_out) - new Date(tc.clock_in)) / 3600000).toFixed(2) : '-'}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* My Notifications */}
          <div className="bg-white rounded-xl shadow-md flex flex-col border border-gray-200 col-span-1 min-h-[200px]">
            <div className="bg-blue-700 rounded-t-xl px-6 pt-6 pb-4">
              <h3 className="text-lg font-semibold text-white mb-0">My Notifications</h3>
            </div>
            <ul className="divide-y divide-gray-100 p-6 flex-1 overflow-y-auto" style={{ maxHeight: '200px' }}>
              <li className="py-2 flex justify-between text-xs sm:text-sm"><span>My Requests</span><span className="font-bold">0</span></li>
              <li className="py-2 flex justify-between text-xs sm:text-sm"><span>Timekeeping</span><span className="font-bold">0</span></li>
              <li className="py-2 flex justify-between text-xs sm:text-sm"><span>System Messages</span><span className="font-bold">0</span></li>
              <li className="py-2 flex justify-between text-xs sm:text-sm"><span>Notices</span><span className="font-bold">0</span></li>
            </ul>
          </div>
          {/* Request Time Off */}
          <div className="bg-white rounded-xl shadow-md flex flex-col border border-gray-200 col-span-1 min-h-[200px]">
            <div className="bg-blue-700 rounded-t-xl px-6 pt-6 pb-4">
              <h3 className="text-lg font-semibold text-white mb-0">Request Time Off</h3>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <span className="text-gray-500 mb-2">Request Time Off</span>
              <button onClick={handleOpenTimeOffModal} className="mt-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition">Time-Off Request</button>
            </div>
          </div>
        </div>
        {/* Time Off Modal */}
        {myEmployee && (
          <TimeOffRequestForm
            employeeId={myEmployee.id}
            show={showTimeOffModal}
            onClose={() => setShowTimeOffModal(false)}
            onSuccess={() => setAlertMsg({ type: 'success', text: 'Time off request submitted successfully.' })}
          />
        )}
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
