import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { supabase } from './supabaseClient';
import { fetchPendingTimeOffCount } from "./utils/requestHandler";
import BreadcrumbsSidebar from './components/BreadcrumbsSidebar';
import {
  CalendarDays, Clock, Timer, Building2, Users, UserPlus,
  MapPin, ClipboardList, Store, Bell, UserCheck, AlertCircle,
  MessageCircle, LayoutDashboard, X
  
} from 'lucide-react';


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
  const sidebarRef = useRef(null);

  const activeLinkClass =
    'bg-gray-200 text-gray-900 font-semibold rounded-md mx-2 my-1';
  const inactiveLinkClass =
    'text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition rounded-md mx-2 my-1';

  useEffect(() => {
    const fetchPendingRequests = async () => {
      const count = await fetchPendingTimeOffCount();
      setPendingTimeOffCount(count);
    };
    fetchPendingRequests();
  }, []);

  // Close sidebar when clicking outside
  useEffect(() => {
    if (!mobileMenuOpen) return;

    function handleClickOutside(event) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Close sidebar on page navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    try {
      // Handle report submission logic here
      setReportMsg('Report submitted successfully');
      setTimeout(() => {
        setReportMsg('');
        setShowReportModal(false);
        setReportSubject('');
        setReportDetails('');
        setReportAgainst('');
        setReportName('');
      }, 2000);
    } catch (error) {
      console.error('Error submitting report:', error);
      setReportMsg('Failed to submit report');
    }
  };

  const isActive = (path) => location.pathname === path;

  const commonLinks = (
    <>
      <Link to="/fetch-schedule" className={`p-3 flex items-center w-full ${isActive('/fetch-schedule') ? activeLinkClass : inactiveLinkClass}`}>
        <CalendarDays className="w-5 h-5 mr-3" />
        <span>View My Schedule</span>
      </Link>
      <Link to="/clock" className={`p-3 flex items-center w-full ${isActive('/clock') ? activeLinkClass : inactiveLinkClass}`}>
        <Clock className="w-5 h-5 mr-3" />
        <span>Clock In/Out</span>
      </Link>
    </>
  );

  return (
    <>
      <BreadcrumbsSidebar toggleSidebar={toggleMobileMenu} />
      
      {/* Overlay for mobile menu */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-40 z-30 lg:hidden" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      <aside 
        ref={sidebarRef}
        className={`w-80 max-w-sm lg:w-64 bg-white shadow-xl h-screen fixed top-16 left-0 z-40 flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="overflow-y-auto">
          <div className="flex justify-between items-center p-4 lg:hidden border-b">
            <h2 className="font-semibold text-gray-800">Menu</h2>
            <button
              className="text-gray-700 hover:text-blue-600"
              onClick={toggleMobileMenu}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          
          {isAuthenticated && (
            <div className="p-2">
              {/* Admin/Owner */}
              {(user?.role_id === 1 || user?.role_id === 2) && (
                <div className="space-y-1">
                  <Link to="/Dashboard" className={`p-3 flex items-center w-full ${isActive('/Dashboard') ? activeLinkClass : inactiveLinkClass}`}>
                    <LayoutDashboard className="w-5 h-5 mr-3" />
                    <span>Dashboard</span>
                  </Link>
                  <Link to="/employees" className={`p-3 flex items-center w-full ${isActive('/employees') ? activeLinkClass : inactiveLinkClass}`}>
                    <Users className="w-5 h-5 mr-3" />
                    <span>Employees</span>
                  </Link>
                  <Link to="/add-employee" className={`p-3 flex items-center w-full ${isActive('/add-employee') ? activeLinkClass : inactiveLinkClass}`}>
                    <UserPlus className="w-5 h-5 mr-3" />
                    <span>Hiring</span>
                  </Link>
                  <Link to="/bulk-geocoding" className={`p-3 flex items-center w-full ${isActive('/bulk-geocoding') ? activeLinkClass : inactiveLinkClass}`}>
                    <MapPin className="w-5 h-5 mr-3" />
                    <span>Stores</span>
                  </Link>
                  <Link to="/clock" className={`p-3 flex items-center w-full ${isActive('/clock') ? activeLinkClass : inactiveLinkClass}`}>
                    <Clock className="w-5 h-5 mr-3" />
                    <span>Clock In/Out</span>
                  </Link>
                  <Link to="/Timecards" className={`p-3 flex items-center w-full ${isActive('/Timecards') ? activeLinkClass : inactiveLinkClass}`}>
                    <Timer className="w-5 h-5 mr-3" />
                    <span>Timecard</span>
                  </Link>
                  <Link to="/chat" className={`p-3 flex items-center w-full ${isActive('/chat') ? activeLinkClass : inactiveLinkClass}`}>
                    <MessageCircle className="w-5 h-5 mr-3" />
                    <span>Chat</span>
                  </Link>
                </div>
              )}

              {/* Manager */}
              {user?.role_id === 3 && (
                <div className="space-y-1">
                  <Link to="/Dashboard" className={`p-3 flex items-center w-full ${isActive('/Dashboard') ? activeLinkClass : inactiveLinkClass}`}>
                    <LayoutDashboard className="w-5 h-5 mr-3" />
                    <span>Dashboard</span>
                  </Link>
                  <Link to="/my-store" className={`p-3 flex items-center w-full ${isActive('/my-store') ? activeLinkClass : inactiveLinkClass}`}>
                    <Store className="w-5 h-5 mr-3" />
                    <span>My Store</span>
                  </Link>
                  <Link to="/schedules" className={`p-3 flex items-center w-full ${isActive('/schedules') ? activeLinkClass : inactiveLinkClass}`}>
                    <ClipboardList className="w-5 h-5 mr-3" />
                    <span>Schedule Planner</span>
                  </Link>
                  <Link to="/employee-requests" className={`p-3 flex items-center w-full relative ${isActive('/employee-requests') ? activeLinkClass : inactiveLinkClass}`}>
                    <UserCheck className="w-5 h-5 mr-3" />
                    <span>Time Off</span>
                    {pendingTimeOffCount > 0 && (
                      <span className="ml-auto h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                        {pendingTimeOffCount}
                      </span>
                    )}
                  </Link>
                  <Link to="/timecards" className={`p-3 flex items-center w-full ${isActive('/timecards') ? activeLinkClass : inactiveLinkClass}`}>
                    <Bell className="w-5 h-5 mr-3" />
                    <span>Timecard</span>
                  </Link>
                  {commonLinks}
                  <Link to="/chat" className={`p-3 flex items-center w-full ${isActive('/chat') ? activeLinkClass : inactiveLinkClass}`}>
                    <MessageCircle className="w-5 h-5 mr-3" />
                    <span>Chat</span>
                  </Link>
                </div>
              )}

              {/* Associate */}
              {(user?.role_id === 4 || user?.role_id === 5 || user?.role_id === 6) && (
                <div className="space-y-1">
                  {commonLinks}
                  <Link to="/Dashboard" className={`p-3 flex items-center w-full ${isActive('/Dashboard') ? activeLinkClass : inactiveLinkClass}`}>
                    <LayoutDashboard className="w-5 h-5 mr-3" />
                    <span>Dashboard</span>
                  </Link>
                  <Link to="/time-off-request" className={`p-3 flex items-center w-full ${isActive('/time-off-request') ? activeLinkClass : inactiveLinkClass}`}>
                    <AlertCircle className="w-5 h-5 mr-3" />
                    <span>Time off</span>
                  </Link>
                  <Link to="/chat" className={`p-3 flex items-center w-full ${isActive('/chat') ? activeLinkClass : inactiveLinkClass}`}>
                    <MessageCircle className="w-5 h-5 mr-3" />
                    <span>Chat</span>
                  </Link>
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