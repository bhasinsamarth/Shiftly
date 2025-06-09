import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// Helper component for dashboard cards (admin/manager view)
const DashboardCard = ({ title, value, icon, bgColor, path }) => (
  <div className={`${bgColor} rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow`}>
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

  // --- ADMIN, OWNER & MANAGER DASHBOARD LOGIC ---
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
          .from('employees')
          .select('salary');
        if (!salaryError && empSalaries) {
          const total = empSalaries.reduce((acc, cur) => acc + Number(cur.salary || 0), 0);
          setTotalPayroll(total);
        } else {
          console.error('Error fetching salaries:', salaryError);
        }

        // Teams count: Fetch number of rows from the store table for owners
        if (user.role_id === 1) {
          const { data: storeRows, error: storeError } = await supabase
            .from('store')
            .select('store_id');
          if (!storeError && storeRows) {
            setTeamsCount(storeRows.length);
          } else {
            console.error('Error fetching store rows:', storeError);
          }
        } else {
          // Teams count: Fetch teams info from the teams table, then count distinct team names.
          const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .select('team');
          if (!teamsError && teamsData) {
            const distinctTeams = new Set(teamsData.map(t => t.team).filter(team => team));
            setTeamsCount(distinctTeams.size);
          } else {
            console.error('Error fetching teams:', teamsError);
          }
        }

        // Pending time-off requests from time_off_requests table
        const { count: toCount, error: toError } = await supabase
          .from('time_off_requests')
          .select('id', { head: true, count: 'exact' })
          .eq('timeoff_requested', true);
        if (!toError) {
          setPendingTimeOff(toCount || 0);
        } else {
          console.error('Error fetching time-off requests:', toError);
        }

        // Recent activity from "activity" table (excluding time-off request updates)
        const { data: actData, error: actError } = await supabase
          .from('activity')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(5);
        if (actError) {
          console.error('Error fetching activity:', actError);
          setErrorActivity('Failed to load recent activity');
        } else {
          const filteredActivity = actData.filter(act => act.type !== 'Time-off Request');
          setActivity(filteredActivity);
        }
        setLoadingActivity(false);
      }
      fetchMetricsAndActivity();
    }
  }, [user]);

  // --- NORMAL USER DASHBOARD LOGIC ---
  const [myEmployee, setMyEmployee] = useState(null);
  const [loadingMyEmp, setLoadingMyEmp] = useState(true);
  const [errorMyEmp, setErrorMyEmp] = useState('');
  const [alertMsg, setAlertMsg] = useState(null);

  // New state for time-off request modal
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // New state for user teams grouping: an object where keys are team names and values are arrays of members
  const [userTeamGroups, setUserTeamGroups] = useState({});
  // New state for open/closed dropdown for user teams
  const [openUserTeams, setOpenUserTeams] = useState({});

  // --- SCHEDULES SECTION ---
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [errorSchedules, setErrorSchedules] = useState('');

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
    if (user && (user.role_id === 3 || user.role_id === 4 || user.role_id === 5)) {
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

  // After myEmployee is fetched, load all teams that the employee is a part of
  useEffect(() => {
    if (myEmployee) {
      async function fetchUserTeams() {
        // Get all teams rows that have a team value equal to one of the teams that the employee belongs to.
        // First, fetch the teams row(s) where the employee is a member.
        const { data, error } = await supabase
          .from("teams")
          .select("*")
          .eq("employee_id", myEmployee.id);
        if (error) {
          setAlertMsg({ type: 'error', text: 'Failed to load your teams.' });
          return;
        }
        if (data) {
          // Get distinct team names
          const distinctTeamNames = Array.from(new Set(data.map(item => item.team)));
          // For each distinct team, fetch all rows belonging to that team.
          let groups = {};
          await Promise.all(
            distinctTeamNames.map(async (teamName) => {
              const { data: groupData, error: groupError } = await supabase
                .from("teams")
                .select("*")
                .eq("team", teamName);
              if (!groupError && groupData) {
                groups[teamName] = groupData;
              }
            })
          );
          setUserTeamGroups(groups);
          // Initialize open/closed state for each team as closed (false)
          const openStates = {};
          distinctTeamNames.forEach(teamName => {
            openStates[teamName] = false;
          });
          setOpenUserTeams(openStates);
        }
      }
      fetchUserTeams();
    }
  }, [myEmployee]);

  // Toggle dropdown for a specific team group
  const toggleUserTeamGroup = (teamName) => {
    setOpenUserTeams((prev) => ({
      ...prev,
      [teamName]: !prev[teamName],
    }));
  };

  // Open the time-off request modal for a specific team (from the user's teams section)
  // This modal appears in the profile section only (as requested, Request Time Off remains in profile)
  const handleOpenTimeOffModal = () => {
    setRequestReason("");
    setStartDate("");
    setEndDate("");
    setShowTimeOffModal(true);
  };

  // Submit a time-off request (for normal users)
  // Here, we store the start and end dates concatenated into the reason column.
  const handleSubmitTimeOffRequest = async (e) => {
    e.preventDefault();
    if (!requestReason || !startDate || !endDate) {
      setAlertMsg({ type: 'error', text: 'Please fill in all fields for your time-off request.' });
      return;
    }
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    if (startDate < today) {
      setAlertMsg({ type: 'error', text: 'The start date cannot be in the past.' });
      return;
    }
    if (endDate < startDate) {
      setAlertMsg({ type: 'error', text: 'The end date cannot be before the start date.' });
      return;
    }
    const fullReason = `${requestReason} (From: ${startDate} To: ${endDate})`;

    try {
      const { error } = await supabase
        .from('time_off_requests')
        .insert([{
          employee_id: myEmployee.id,
          // Optionally, if you want to record which team the request applies to,
          // you can add a "team" field here. For example, if the employee belongs to only one team:
          // team: myEmployee.team,
          timeoff_requested: true,
          reason: fullReason
        }]);
      if (error) {
        setAlertMsg({ type: 'error', text: 'Failed to submit time off request.' });
      } else {
        setAlertMsg({ type: 'success', text: 'Time off request submitted successfully.' });
        // Update local employee state if needed.
        setMyEmployee({ ...myEmployee, timeoff_request: 'requested' });
        setShowTimeOffModal(false);
      }
    } catch (err) {
      console.error("Unexpected error submitting time off request:", err);
      setAlertMsg({ type: 'error', text: 'Unexpected error occurred while submitting your request.' });
    }
  };

  // Withdraw a time-off request for a normal user (global withdrawal)
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

  // Helper to get role description from role_id
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

  // --- EFFECTS FOR NORMAL USER DASHBOARD LOGIC ---
  useEffect(() => {
    if (user && (user.role_id === 3 || user.role_id === 4 || user.role_id === 5)) {
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
    if (user && (user.role_id === 3 || user.role_id === 4 || user.role_id === 5)) {
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
    if (user && (user.role_id === 3 || user.role_id === 4 || user.role_id === 5)) {
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

  // --- AVAILABILITY REQUEST HANDLER ---
  const handleSubmitAvailability = async (e) => {
    e.preventDefault();
    // Insert availability request for manager review
    const { error } = await supabase.from('availability_requests').insert([
      { employee_id: user.id, days: availDays, times: availTimes, status: 'pending' }
    ]);
    if (error) setAvailMsg('Failed to submit availability request.');
    else setAvailMsg('Availability request submitted.');
    setShowAvailModal(false);
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
    // Owner/Manager dashboard
    const dynamicDashboardCards = [
      { title: 'Employees', value: employeesCount, icon: '👥', bgColor: 'bg-blue-50', path: '/employees' },
      { title: 'Teams', value: teamsCount, icon: '🏢', bgColor: 'bg-green-50', path: '/teams' },
      { title: 'Time-off Requests', value: pendingTimeOff, icon: '📅', bgColor: 'bg-yellow-50', path: '/time-off' },
      { title: 'Payroll', value: totalPayroll ? `$${totalPayroll}` : '$0', icon: '💰', bgColor: 'bg-purple-50', path: '/payroll' },
    ];

    return (
      <div className="max-w-6xl mx-auto p-4">
        {accessDenied && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {accessMessage || 'You do not have permission to access the requested page.'}
                </p>
              </div>
            </div>
          </div>
        )}
        <section className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
              Welcome {greetingName}
            </h1>
            <p className="text-gray-600">
              Here's what's happening within your organization today.
            </p>
        </section>
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {dynamicDashboardCards.map((card, index) => (
            <DashboardCard key={index} {...card} />
          ))}
        </section>
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="bg-white rounded-lg shadow-md p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      When
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      By
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activity.map(act => (
                    <tr key={act.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {act.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {act.action}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {act.subject}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(act.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {act.user_name || act.user_email || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600">No recent activity found.</p>
          )}
        </section>
      </div>
    );
  } else if (user && (user.role_id === 3 || user.role_id === 4 || user.role_id === 5)) {
    // Full-time Associate, Part-time Associate, Interns dashboard
    if (loadingMyEmp) {
      return <div className="max-w-4xl mx-auto p-4">Loading your data...</div>;
    }
    if (errorMyEmp) {
      return <div className="max-w-4xl mx-auto p-4 text-red-500">{errorMyEmp}</div>;
    }
    if (!myEmployee) {
      return <div className="max-w-4xl mx-auto p-4">You are not an employee.</div>;
    }

    return (
      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Greeting */}
        <div className="col-span-4 mb-6" style={{ backgroundColor: '#004dcf', borderRadius: '0.75rem', padding: '1.5rem' }}>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Hi {myEmployee.first_name}{myEmployee.last_name ? ` ${myEmployee.last_name}` : ''}</h1>
        </div>
        {/* My Schedule */}
        <div className="bg-white rounded-xl shadow-md p-6 flex flex-col col-span-1 border border-black-200 group hover:bg-blue-700">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 group-hover:text-white transition">My Schedule</h3>
          <div className="flex-1 overflow-y-auto group-hover:text-white transition">
            {schedules.length === 0 ? (
              <p className="text-gray-500">You have nothing planned.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {schedules.slice(0, 5).map((sch, idx) => (
                  <li key={sch.id || idx} className="py-2 flex items-center">
                    <div className="w-12 text-center">
                      <span className="block text-xs text-gray-400 font-medium">
                        {new Date(sch.shift_start).toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span className="block text-lg font-bold text-gray-700">
                        {new Date(sch.shift_start).getDate()}
                      </span>
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="text-sm text-gray-700 font-medium">
                        {sch.shift_start && sch.shift_end ? `${new Date(sch.shift_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(sch.shift_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No shift'}
                      </div>
                      <div className="text-xs text-gray-500">{sch.department || sch.location || ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* My Timecard */}
        <div className="bg-white rounded-xl shadow-md p-6 flex flex-col col-span-1 border border-black-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">My Timecard</h3>
          {timeCards.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <span className="text-5xl mb-2">🕒</span>
              <span>No data to display.</span>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {timeCards.slice(0, 5).map((tc, idx) => (
                <li key={tc.id || idx} className="py-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">{tc.date}</span>
                    <span className="text-gray-500">{tc.clock_in ? `${new Date(tc.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '--'} - {tc.clock_out ? `${new Date(tc.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '--'}</span>
                  </div>
                  <div className="text-xs text-gray-500">Hours: {tc.clock_in && tc.clock_out ? ((new Date(tc.clock_out) - new Date(tc.clock_in))/3600000).toFixed(2) : '-'}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* My Notifications */}
        <div className="bg-white rounded-xl shadow-md p-6 flex flex-col col-span-1 border border-black-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">My Notifications</h3>
          <ul className="divide-y divide-gray-100">
            <li className="py-2 flex justify-between text-sm"><span>My Requests</span><span className="font-bold">0</span></li>
            <li className="py-2 flex justify-between text-sm"><span>Timekeeping</span><span className="font-bold">0</span></li>
            <li className="py-2 flex justify-between text-sm"><span>System Messages</span><span className="font-bold">0</span></li>
            <li className="py-2 flex justify-between text-sm"><span>Notices</span><span className="font-bold">0</span></li>
          </ul>
        </div>

        {/* Request Time Off */}
        <div className="bg-white rounded-xl shadow-md p-6 flex flex-col col-span-1 border border-black-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Request Time Off</h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="text-gray-500 mb-2">Request Time Off</span>
            <button
              onClick={handleOpenTimeOffModal}
              className="mt-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
            >
              Time-Off Request
            </button>
          </div>
        </div>

        {/* Clock In / Out */}
        <div className="bg-white rounded-xl shadow-md p-6 flex flex-col col-span-1 border border-black-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Clock In / Out</h3>
          <div className="flex flex-col items-center space-y-3">
            <button
              onClick={handleClockIn}
              disabled={isClockedIn}
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 w-full"
            >
              Clock In/Clock Out
            </button>
          </div>
        </div>

        {/* Complaint */}
        <div className="bg-white rounded-xl shadow-md p-6 flex flex-col col-span-1 border border-black-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Complaint</h3>
          <div className="flex flex-col items-center justify-center flex-1">
            <button
              onClick={() => setShowComplaintModal(true)}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition w-full"
            >
              Raise Complaint
            </button>
            {complaintMsg && <span className="text-sm text-gray-700 mt-2">{complaintMsg}</span>}
          </div>
        </div>

        {/* Time Off Modal */}
        {showTimeOffModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
            <div className="bg-white rounded-lg shadow-xl p-8 w-96">
              <form onSubmit={handleSubmitTimeOffRequest}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Reason</label>
                  <textarea
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    placeholder="Enter the reason for your time off request"
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 resize-none"
                    rows="4"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </div>
                <div className="flex justify-end space-x-4">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                  >
                    Submit Request
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTimeOffModal(false)}
                    className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Complaint Modal */}
        {showComplaintModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
            <div className="bg-white rounded-lg shadow-xl p-8 w-96">
              <form onSubmit={handleSubmitComplaint}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Against (Name or Role)</label>
                  <input
                    type="text"
                    value={complaintAgainst}
                    onChange={e => setComplaintAgainst(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Subject</label>
                  <input
                    type="text"
                    value={complaintSubject}
                    onChange={e => setComplaintSubject(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Details</label>
                  <textarea
                    value={complaintDetails}
                    onChange={e => setComplaintDetails(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300"
                    rows="4"
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700">Your Name (optional)</label>
                  <input
                    type="text"
                    value={complaintName}
                    onChange={e => setComplaintName(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300"
                  />
                </div>
                <div className="flex justify-end space-x-4">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowComplaintModal(false)}
                    className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  } else {
    return (
      <div className="max-w-6xl mx-auto p-4">
        Please log in to view the dashboard.
      </div>
    );
  }
};

export default Dashboard;
