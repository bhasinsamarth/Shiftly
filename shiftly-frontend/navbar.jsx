import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { supabase } from './supabaseClient';
import { fetchPendingTimeOffCount } from "./utils/requestHandler";
import BreadcrumbsSidebar from './components/BreadcrumbsSidebar';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingTimeOffCount, setPendingTimeOffCount] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubject, setReportSubject] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportAgainst, setReportAgainst] = useState('');
  const [reportName, setReportName] = useState('');
  const [reportMsg, setReportMsg] = useState('');

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
                </div>
              )}

              {/* Associate */}
              {(user?.role_id === 4 || user?.role_id === 5 || user?.role_id === 6) && (

                <div >
                  
                  <Link to="/Dashboard" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/Dashboard') ? activeLinkClass : inactiveLinkClass}`}>#️⃣ Dashboard</Link>
                  {commonLinks}
                   <Link to="/time-off-request" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/time-off-request') ? activeLinkClass : inactiveLinkClass}`}>🕐 Time off</Link>
                </div>

              )}
            </div>
          )}
        </div>
                  <Link to="/chat" className="border-transparent text-gray-500 hover:border-blue-500 hover:text-blue-600 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                    Chat
                  </Link>
                  {(user?.role_id === 1 || user?.role_id === 2) && (
                    <>
                      <Link to="/employees" className="border-transparent text-gray-500 hover:border-blue-500 hover:text-blue-600 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                        Employees
                      </Link>
                      <Link to="/teams" className="border-transparent text-gray-500 hover:border-blue-500 hover:text-blue-600 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                        Teams
                      </Link>
                    </>
                  )}
                  {user?.role_id === 3 && (
                    <Link to="/employee-requests" className="relative border-transparent text-gray-500 hover:border-blue-500 hover:text-blue-600 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                      Employee Requests
                      {pendingTimeOffCount > 0 && (
                        <span className="absolute top-2 right-1 block h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                          {pendingTimeOffCount}
                        </span>
                      )}
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {isAuthenticated && (
              <div className="ml-3 relative">
                <button
                  type="button"
                  className="bg-white rounded-full flex text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  id="user-menu-button"
                  onClick={toggleProfileDropdown}
                >
                  <span className="sr-only">Open user menu</span>
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                      {user?.username?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </div>
                  )}
                </button>
                {profileDropdownOpen && (
                  <div
                    id="user-menu-dropdown"
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5"
                    role="menu"
                    aria-orientation="vertical"
                    tabIndex="-1"
                  >
                    <div className="block px-4 py-2 text-sm text-gray-700">
                      Signed in as <strong>{user?.preferred_name || user?.first_name || user?.username || user?.email}</strong>
                    </div>
                    <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      My Profile
                    </Link>
                    <button onClick={() => setShowReportModal(true)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      Report Issue
                    </button>
                    <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center sm:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              onClick={toggleMobileMenu}
            >
              <span className="sr-only">Open main menu</span>
              <svg className={`${mobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <svg className={`${mobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && isAuthenticated && (
        <div className="sm:hidden px-2 pt-2 pb-3 space-y-1">
          <Link to="/dashboard" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100">Dashboard</Link>
          <Link to="/chat" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100">Chat</Link>

          {(user?.role_id === 1 || user?.role_id === 2) && (
            <>
              <Link to="/employees" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100">Employees</Link>
              <Link to="/teams" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100">Teams</Link>
            </>
          )}

          {user?.role_id === 3 && (
            <Link to="/employee-requests" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100 relative">
              Employee Requests
              {pendingTimeOffCount > 0 && (
                <span className="absolute top-2 right-3 inline-flex items-center justify-center px-1 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                  {pendingTimeOffCount}
                </span>
              )}
            </Link>
          )}
        </div>
      )}

        {showReportModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8 w-full max-w-md">
              <form onSubmit={handleSubmitReport}>
                <h2 className="text-lg font-semibold mb-4">Report Issue</h2>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Subject</label>
                  <input type="text" value={reportSubject} onChange={e => setReportSubject(e.target.value)} required className="mt-1 block w-full rounded-md border border-gray-300" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Details</label>
                  <textarea value={reportDetails} onChange={e => setReportDetails(e.target.value)} required className="mt-1 block w-full rounded-md border border-gray-300" rows="4" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Against (optional)</label>
                  <input type="text" value={reportAgainst} onChange={e => setReportAgainst(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300" />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700">Your Name (optional)</label>
                  <input type="text" value={reportName} onChange={e => setReportName(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300" />
                </div>
                <div className="flex justify-end space-x-4">
                  <button type="submit" className="px-5 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800 transition">Submit</button>
                  <button type="button" onClick={() => setShowReportModal(false)} className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md">Cancel</button>
                </div>
                {reportMsg && <div className="mt-4 text-green-600">{reportMsg}</div>}
              </form>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Navbar;