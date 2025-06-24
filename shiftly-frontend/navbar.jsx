import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { supabase } from './supabaseClient';
import { fetchPendingTimeOffCount } from "./utils/requestHandler";

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
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
            console.error('Error fetching profile photo path:', error);
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
              console.error('Error fetching public URL for profile photo:', urlError);
              setProfileImage('https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg');
              return;
            }

            setProfileImage(publicUrl?.publicUrl);
          } else {
            setProfileImage('https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg');
          }
        } catch (err) {
          console.error('Unexpected error fetching profile image:', err);
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
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error during Supabase sign out:', error);
    await logout();
    navigate('/login');
  };

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const toggleProfileDropdown = () => setProfileDropdownOpen(!profileDropdownOpen);

  useEffect(() => {
    if (!profileDropdownOpen) return;

    const handleClickOutside = (event) => {
      const dropdownButton = document.getElementById('user-menu-button');
      const dropdownMenu = document.getElementById('user-menu-dropdown');

      if (
        dropdownButton && !dropdownButton.contains(event.target) &&
        dropdownMenu && !dropdownMenu.contains(event.target)
      ) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleClickOutside = (event) => {
      const menuButton = document.querySelector('.inline-flex.items-center.justify-center.p-2');
      const menuDropdown = document.querySelector('.absolute.top-16.left-0.w-full.bg-white.shadow-md.z-50');

      if (
        menuButton && !menuButton.contains(event.target) &&
        menuDropdown && !menuDropdown.contains(event.target)
      ) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('complaints').insert([{
      against: reportAgainst || null,
      subject: reportSubject,
      details: reportDetails,
      name: reportName || null,
      employee_id: user.id,
      anonymous: !reportName
    }]);
    setReportMsg(error ? 'Failed to submit report.' : 'Issue reported.');
    setShowReportModal(false);
    setReportAgainst(''); setReportSubject(''); setReportDetails(''); setReportName('');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
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
            <Link to={isAuthenticated ? "/dashboard" : "/"} className="ml-2 text-xl font-bold text-blue-600">
              Shiftly
            </Link>
          </div>

          {mobileMenuOpen && (
            <div className="absolute top-16 left-0 w-full bg-white shadow-md z-50">
              <div className="flex flex-col space-y-2 p-4">
                {isAuthenticated && (
                  <>
                    {/* Removed Dashboard option */}
                    {(user?.role_id === 1 || user?.role_id === 2) && (
                      <>
                        <Link to="/employees" className="text-gray-700 hover:text-blue-600">Employees</Link>
                        <Link to="/teams" className="text-gray-700 hover:text-blue-600">Teams</Link>
                      </>
                    )}
                    {user?.role_id === 3 && (
                      <Link to="/employee-requests" className="text-gray-700 hover:text-blue-600">Employee Requests</Link>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="hidden sm:flex sm:items-center w-full justify-between">
            <div className="flex-shrink-0 flex items-center space-x-6">
              <Link to={isAuthenticated ? "/dashboard" : "/"} className="text-xl font-bold text-blue-600">
                Shiftly
              </Link>
              {isAuthenticated && (
                <>
                  {(user?.role_id === 1 || user?.role_id === 2) && (
                    <>
                      <Link to="/employees" className="text-gray-700 hover:text-blue-600">Employees</Link>
                      <Link to="/teams" className="text-gray-700 hover:text-blue-600">Teams</Link>
                    </>
                  )}
                  {user?.role_id === 3 && (
                    <Link to="/employee-requests" className="text-gray-700 hover:text-blue-600">Employee Requests</Link>
                  )}
                </>
              )}
            </div>
            {isAuthenticated && (
              <div className="flex items-center space-x-6">
                {/* Desktop Nav Links */}
                {/* Profile Photo & Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    className="bg-white rounded-full flex text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    id="user-menu-button-desktop"
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
                      id="user-menu-dropdown-desktop"
                      className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5"
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Modal */}
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
    </nav>
  );
};

export default Navbar;
