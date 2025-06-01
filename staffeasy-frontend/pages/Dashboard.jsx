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

  const accessDenied = location.state?.accessDenied;
  const accessMessage = location.state?.message;

  // --- ADMIN & MANAGER DASHBOARD LOGIC (unchanged) ---
  const [employeesCount, setEmployeesCount] = useState(0);
  const [teamsCount, setTeamsCount] = useState(0);
  const [pendingTimeOff, setPendingTimeOff] = useState(0);
  const [totalPayroll, setTotalPayroll] = useState(0);
  const [activity, setActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [errorActivity, setErrorActivity] = useState('');

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'manager')) {
      async function fetchMetricsAndActivity() {
        // Employee count from employees table
        const { count: empCount, error: countError } = await supabase
          .from('employees')
          .select('id', { head: true, count: 'exact' });
        if (!countError) {
          setEmployeesCount(empCount || 0);
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

  useEffect(() => {
    if (user && user.role === 'user') {
      async function fetchMyEmployee() {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .eq('email', user.email)
          .single();
        if (error) {
          console.error('Error fetching your employee data:', error);
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

  // --- RENDERING ---
  if (user && (user.role === 'admin' || user.role === 'manager')) {
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
            Welcome back, {username}
          </h1>
          <p className="text-gray-600">
            Here's what's happening with your organization today.
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
  } else if (user && user.role === 'user') {
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
      <div className="max-w-4xl mx-auto p-4">
        {/* Profile Section */}
        <div className="bg-white shadow-lg rounded-lg p-8 mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">Your Profile</h2>
          {alertMsg && (
            <div className={`mb-4 p-4 rounded ${alertMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {alertMsg.text}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-gray-700"><strong>Name:</strong> {myEmployee.name}</p>
              <p className="text-gray-700"><strong>Position:</strong> {myEmployee.position}</p>
              <p className="text-gray-700"><strong>Department:</strong> {myEmployee.department}</p>
              <p className="text-gray-700"><strong>Email:</strong> {myEmployee.email}</p>
            </div>
            <div>
              <p className="text-gray-700"><strong>Phone:</strong> {myEmployee.phone || 'N/A'}</p>
              <p className="text-gray-700"><strong>Salary:</strong> {myEmployee.salary ? `$${myEmployee.salary}` : 'N/A'}</p>
              <p className="text-gray-700"><strong>Teams:</strong> {myEmployee.team || 'N/A'}</p>
              <p className="text-gray-700"><strong>Time-off Request:</strong> {myEmployee.timeoff_request ? 'Requested' : 'Not Requested'}</p>
            </div>
          </div>
          {/* Request Time Off button remains in the profile section */}
          <div className="mt-6">
            { !myEmployee.timeoff_request ? (
              <button
                onClick={handleOpenTimeOffModal}
                className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Request Time Off
              </button>
            ) : (
              <button
                onClick={handleWithdrawTimeOff}
                className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Withdraw Request
              </button>
            )}
          </div>
        </div>

        {/* Teams Section: Display dropdowns for each team the user is part of */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Your Teams</h2>
          {Object.keys(userTeamGroups).length === 0 ? (
            <p>You are not part of any teams.</p>
          ) : (
            <div className="space-y-4">
              {Object.keys(userTeamGroups).map(teamName => (
                <div key={teamName} className="bg-white p-4 rounded shadow border border-gray-200">
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleUserTeamGroup(teamName)}>
                    <span className="text-lg font-medium text-gray-800">{teamName}</span>
                    <span>{openUserTeams[teamName] ? '-' : '+'}</span>
                  </div>
                  {openUserTeams[teamName] && (
                    <ul className="mt-2 pl-4 border-l border-gray-300">
                      {userTeamGroups[teamName].map(member => (
                        <li key={member.employee_id} className="text-gray-700 text-sm">
                          {member.employee_name} (ID: {member.employee_id})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Time Off Request Modal (for normal users) */}
        {showTimeOffModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
            <div className="bg-white rounded-lg shadow-xl p-8 w-96">
              <form onSubmit={handleSubmitTimeOffRequest}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Reason
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700">
                    End Date
                  </label>
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
