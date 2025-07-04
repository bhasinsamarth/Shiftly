import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { supabase } from './supabaseClient';
import { fetchPendingTimeOffCount } from "./utils/requestHandler";

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [profileImage, setProfileImage] = useState(null);
  const [pendingTimeOffCount, setPendingTimeOffCount] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubject, setReportSubject] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportAgainst, setReportAgainst] = useState('');
  const [reportName, setReportName] = useState('');
  const [reportMsg, setReportMsg] = useState('');

  useEffect(() => {
    const fetchProfileImage = async () => {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from('employee')
            .select('profile_photo_path')
            .eq('id', user.id)
            .single();

          if (error) {
            setProfileImage('https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg');
            return;
          }

          const photoPath = data?.profile_photo_path;
          if (photoPath) {
            const { data: publicUrl, error: urlError } = await supabase
              .storage
              .from('profile-photo')
              .getPublicUrl(photoPath);

            if (urlError) {
              setProfileImage('https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg');
              return;
            }

            setProfileImage(publicUrl?.publicUrl);
          } else {
            setProfileImage('https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg');
          }
        } catch {
          setProfileImage('https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg');
        }
      }
    };
    fetchProfileImage();
  }, [user]);

  useEffect(() => {
    const fetchPendingRequests = async () => {
      const count = await fetchPendingTimeOffCount();
      setPendingTimeOffCount(count);
    };
    fetchPendingRequests();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut(); // Always sign out from Supabase session
    await logout(); // Clear app state and storage
    navigate('/login');
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const toggleProfileDropdown = () => {
    setProfileDropdownOpen(!profileDropdownOpen);
  };

  const isActive = (path) => location.pathname === path;

  const commonLinks = (
    <>
      <Link to="/fetch-schedule" className={`block text-gray-700 hover:text-blue-600 ${isActive('/fetch-schedule') ? 'bg-blue-100' : ''}`}>📆 View My Schedule</Link>
      <Link to="/clock" className={`block text-gray-700 hover:text-blue-600 ${isActive('/clock') ? 'bg-blue-100' : ''}`}>🕐 Clock In/Out</Link>
    </>
  );

  return (
    <aside className={`w-full lg:w-1/6 bg-white shadow-md h-screen lg:fixed top-0 left-0 z-40 flex flex-col justify-between ${mobileMenuOpen ? 'block' : 'hidden'} lg:block`}>
      <div className="p-6">
        <button
          className="lg:hidden text-gray-700 hover:text-blue-600 mb-4"
          onClick={toggleMobileMenu}
        >
          {mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
        </button>
        <Link to={isAuthenticated ? "/dashboard" : "/"} className="text-2xl font-bold block mb-8 text-blue-700 hover:text-blue-800">
          Shiftly
        </Link>
        {isAuthenticated && (
          <div className="space-y-4">
            {/* Admin/Owner */}
            {(user?.role_id === 1 || user?.role_id === 2) && (
              <>
                <Link to="/employees" className={`block text-gray-700 hover:text-blue-600 ${isActive('/employees') ? 'bg-blue-100' : ''}`}>👨‍💼 Employees</Link>
                <Link to="/teams" className={`block text-gray-700 hover:text-blue-600 ${isActive('/teams') ? 'bg-blue-100' : ''}`}>🏢 Teams</Link>
                <Link to="/add-employee" className={`block text-gray-700 hover:text-blue-600 ${isActive('/add-employee') ? 'bg-blue-100' : ''}`}>📝 Hiring</Link>
                <Link to="/bulk-geocoding" className={`block text-gray-700 hover:text-blue-600 ${isActive('/bulk-geocoding') ? 'bg-blue-100' : ''}`}>📍 Setup Store Locations</Link>
              </>
            )}

            {/* Manager */}
            {user?.role_id === 3 && (
              <div className="space-y-6">
                <Link to="/my-store" className={`w-full block text-gray-700 hover:text-blue-600 ${isActive('/my-store') ? 'bg-blue-100' : ''}`}>🏪 My Store</Link>
                <Link to="/bulk-geocoding" className={`w-full block text-gray-700 hover:text-blue-600 ${isActive('/bulk-geocoding') ? 'bg-blue-100' : ''}`}>📍 Setup Store Location</Link>
                <Link to="/schedules" className={`block text-gray-700 hover:text-blue-600 ${isActive('/schedules') ? 'bg-blue-100' : ''}`}>📝 Schedule Planner</Link>
                <Link to="/time-off" className={`w-full relative block text-gray-700 hover:text-blue-600 ${isActive('/time-off') ? 'bg-blue-100' : ''}`}>
                  🕐 Time Off
                  {pendingTimeOffCount > 0 && (
                    <span className="absolute left-12 bottom-3 mx-11 block h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                      {pendingTimeOffCount}
                    </span>
                  )}
                </Link>
                {commonLinks}
                <Link to="/" className="w-full block text-gray-700 hover:text-blue-600">📃 Analytics</Link>
              </div>
            )}

            {/* Associate */}
            {(user?.role_id === 4 || user?.role_id === 5 || user?.role_id === 6) && (
              <>
                {commonLinks}
                <Link to="/time-off-request" className="w-full block text-gray-700 hover:text-blue-600">🕐 Time off</Link>
                <Link to="/shifts" className="w-full block text-gray-700 hover:text-blue-600">⌛ Timecard</Link>
                <Link to="/requests" className="w-full block text-gray-700 hover:text-blue-600">🔔 Notifications</Link>
              </>
            )}
          </div>
        )}
      </div>

      {isAuthenticated && (
        <div className="p-6 border-t">
          <div className="flex items-center space-x-4">
            {profileImage ? (
              <img src={profileImage} alt="Profile" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                {user?.username?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">
                {user?.preferred_name || user?.first_name || user?.username || user?.email}
              </p>
              <button onClick={toggleProfileDropdown} className="text-xs text-blue-500 hover:underline">
                Profile Menu
              </button>
              {profileDropdownOpen && (
                <div
                  id="user-menu-dropdown"
                  className="mt-2 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 py-1 text-sm"
                >
                  <Link to="/profile" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">My Profile</Link>
                  <button onClick={() => setShowReportModal(true)} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100">
                    Report Issue
                  </button>
                  <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100">
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
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
  );
};

export default Navbar;