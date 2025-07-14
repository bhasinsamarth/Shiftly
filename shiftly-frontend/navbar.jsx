import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { supabase } from './supabaseClient';
import { fetchPendingTimeOffCount } from "./utils/requestHandler";
import BreadcrumbsSidebar from './components/BreadcrumbsSidebar';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingTimeOffCount, setPendingTimeOffCount] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubject, setReportSubject] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportAgainst, setReportAgainst] = useState('');
  const [reportName, setReportName] = useState('');
  const [reportMsg, setReportMsg] = useState('');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [profileImage, setProfileImage] = useState('');

  const activeLinkClass =
    'bg-gray-200 text-gray-900 font-semibold rounded';
  const inactiveLinkClass =
    'text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition rounded-none';

  useEffect(() => {
    const fetchPendingRequests = async () => {
      const count = await fetchPendingTimeOffCount();
      setPendingTimeOffCount(count);
    };
    fetchPendingRequests();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('reports')
        .insert([
          {
            subject: reportSubject,
            details: reportDetails,
            against: reportAgainst,
            reporter_name: reportName,
            user_id: user?.id
          }
        ]);

      if (error) throw error;
      
      setReportMsg('Report submitted successfully!');
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubject('');
        setReportDetails('');
        setReportAgainst('');
        setReportName('');
        setReportMsg('');
      }, 2000);
    } catch (error) {
      console.error('Error submitting report:', error);
      setReportMsg('Error submitting report. Please try again.');
    }
  };

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const toggleProfileDropdown = () => setProfileDropdownOpen(!profileDropdownOpen);

  const isActive = (path) => location.pathname === path;

  const commonLinks = (
    <>
      <Link to="/fetch-schedule" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/fetch-schedule') ? activeLinkClass : inactiveLinkClass}`}>📆 View My Schedule</Link>
      <Link to="/clock" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/clock') ? activeLinkClass : inactiveLinkClass}`}>🕐 Clock In/Out</Link>
    </>
  );

  return (
    <>
      <BreadcrumbsSidebar />
      <aside className={`w-full lg:w-1/6 bg-white shadow-md h-screen lg:fixed top-[48px] left-0 z-40 flex flex-col justify-between ${mobileMenuOpen ? 'block' : 'hidden'} lg:block`}>
        <div className="">
          <button
            className="lg:hidden text-gray-700 hover:text-blue-600 mb-4"
            onClick={toggleMobileMenu}
          >
            {mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
          </button>
          {isAuthenticated && (
            <div >
              {/* Admin/Owner */}
              {(user?.role_id === 1 || user?.role_id === 2) && (
                <div>
                  <Link to="/Dashboard" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/Dashboard') ? activeLinkClass : inactiveLinkClass}`}>#️⃣ Dashboard</Link>
                  <Link to="/employees" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/employees') ? activeLinkClass : inactiveLinkClass}`}>👨‍💼 Employees</Link>
                  <Link to="/teams" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/teams') ? activeLinkClass : inactiveLinkClass}`}>🏢 Teams</Link>
                  <Link to="/add-employee" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/add-employee') ? activeLinkClass : inactiveLinkClass}`}>📝 Hiring</Link>
                  <Link to="/bulk-geocoding" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/bulk-geocoding') ? activeLinkClass : inactiveLinkClass}`}>📍 Setup Store Locations</Link>
                  <Link to="/employee-requests" className={`w-full relative p-7 flex items-center h-7 leading-7 ${isActive('/time-off') ? activeLinkClass : inactiveLinkClass}`}>
                    🕐 Time Off
                    {pendingTimeOffCount > 0 && (
                      <span className="ml-3 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                        {pendingTimeOffCount}
                      </span>
                    )}
                  </Link>
                  <Link to="/clock" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/clock') ? activeLinkClass : inactiveLinkClass}`}>🕐 Clock In/Out</Link>
                  <Link to="/Timecards" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/Timecards') ? activeLinkClass : inactiveLinkClass}`}>⌛ Timecard</Link>
                  <Link to="/chat" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/chat') ? activeLinkClass : inactiveLinkClass}`}>💬 Chat</Link>
                </div>


              )}

              {/* Manager */}
              {user?.role_id === 3 && (
                <div >
                  <Link to="/Dashboard" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/Dashboard') ? activeLinkClass : inactiveLinkClass}`}>#️⃣ Dashboard</Link>
                  <Link to="/my-store" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/my-store') ? activeLinkClass : inactiveLinkClass}`}>🏪 My Store</Link>

                  <Link to="/schedules" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/schedules') ? activeLinkClass : inactiveLinkClass}`}>📝 Schedule Planner</Link>
                  <Link to="/employee-requests" className={`w-full relative p-7 flex items-center h-7 leading-7 ${isActive('/time-off') ? activeLinkClass : inactiveLinkClass}`}>
                    🕐 Time Off
                    {pendingTimeOffCount > 0 && (
                      <span className="ml-3 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                        {pendingTimeOffCount}
                      </span>
                    )}
                  </Link>
                  {commonLinks}
<Link to="/Timecards" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/Timecards') ? activeLinkClass : inactiveLinkClass}`}>⌛ Timecard</Link>
                  <Link to="/chat" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/chat') ? activeLinkClass : inactiveLinkClass}`}>💬 Chat</Link>
                </div>
              )}

              {/* Associate */}
              {(user?.role_id === 4 || user?.role_id === 5 || user?.role_id === 6) && (

                <div >
                  
                  <Link to="/Dashboard" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/Dashboard') ? activeLinkClass : inactiveLinkClass}`}>#️⃣ Dashboard</Link>
                  {commonLinks}
                   <Link to="/time-off-request" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/time-off-request') ? activeLinkClass : inactiveLinkClass}`}>🕐 Time off</Link>
                   <Link to="/chat" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/chat') ? activeLinkClass : inactiveLinkClass}`}>💬 Chat</Link>
                </div>

              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Navbar;