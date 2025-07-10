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


  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const isActive = (path) => location.pathname === path;

  const commonLinks = (
    <>
      <Link to="/fetch-schedule" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/fetch-schedule') ? activeLinkClass : inactiveLinkClass}`}>📆 View My Schedule</Link>
      <Link to="/clock" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/clock') ? activeLinkClass : inactiveLinkClass}`}>🕐 Clock In/Out</Link>
      <Link to="/Timecards" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/Timecards') ? activeLinkClass : inactiveLinkClass}`}>⌛ Timecard</Link>
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
                <div className='space-y-6'>
                  <Link to="/Dashboard" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/Dashboard') ? activeLinkClass : inactiveLinkClass}`}>#️⃣ Dashboard</Link>
                  <Link to="/employees" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/employees') ? activeLinkClass : inactiveLinkClass}`}>👨‍💼 Employees</Link>
                  <Link to="/teams" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/teams') ? activeLinkClass : inactiveLinkClass}`}>🏢 Teams</Link>
                  <Link to="/add-employee" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/add-employee') ? activeLinkClass : inactiveLinkClass}`}>📝 Hiring</Link>
                  <Link to="/bulk-geocoding" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/bulk-geocoding') ? activeLinkClass : inactiveLinkClass}`}>📍 Setup Store Locations</Link>
                  <Link to="/clock" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/clock') ? activeLinkClass : inactiveLinkClass}`}>🕐 Clock In/Out</Link>
                  <Link to="/Timecards" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/Timecards') ? activeLinkClass : inactiveLinkClass}`}>⌛ Timecard</Link>
                </div>

              )}

              {/* Manager */}
              {user?.role_id === 3 && (
                <div >
                  <Link to="/Dashboard" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/Dashboard') ? activeLinkClass : inactiveLinkClass}`}>#️⃣ Dashboard</Link>
                  <Link to="/my-store" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/my-store') ? activeLinkClass : inactiveLinkClass}`}>🏪 My Store</Link>
                  <Link to="/bulk-geocoding" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/bulk-geocoding') ? activeLinkClass : inactiveLinkClass}`}>📍 Setup Store Location</Link>
                  <Link to="/schedules" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/schedules') ? activeLinkClass : inactiveLinkClass}`}>📝 Schedule Planner</Link>
                  <Link to="/time-off" className={`w-full relative p-7 flex items-center h-7 leading-7 ${isActive('/time-off') ? activeLinkClass : inactiveLinkClass}`}>
                    🕐 Time Off
                    {pendingTimeOffCount > 0 && (
                      <span className="ml-3 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                        {pendingTimeOffCount}
                      </span>
                    )}
                  </Link>
                  {commonLinks}
                  <Link to="/" className={`w-full relative p-7 flex items-center h-7 leading-7 ${isActive('/') ? activeLinkClass : inactiveLinkClass}`}>📃 Analytics</Link>
                </div>
              )}

              {/* Associate */}
              {(user?.role_id === 4 || user?.role_id === 5 || user?.role_id === 6) && (

                <div >
                  {commonLinks}
                  <Link to="/Dashboard" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/Dashboard') ? activeLinkClass : inactiveLinkClass}`}>#️⃣ Dashboard</Link>
                  <Link to="/time-off-request" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/time-off-request') ? activeLinkClass : inactiveLinkClass}`}>🕐 Time off</Link>
                  <Link to="/requests" className={`p-7 flex items-center w-full h-7 leading-7 ${isActive('/requests') ? activeLinkClass : inactiveLinkClass}`}>🔔 Notifications</Link>
                </div>

              )}
            </div>
          )}
        </div>

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