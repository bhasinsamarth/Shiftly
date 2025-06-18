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
        const { data, error } = await supabase
          .from('employee')
          .select('profile_photo_path')
          .eq('id', user.id)
          .single();

        const photoPath = data?.profile_photo_path;
        if (photoPath) {
          const { data: publicUrl } = supabase
            .storage
            .from('profile-photo')
            .getPublicUrl(photoPath);
          setProfileImage(publicUrl?.publicUrl);
        } else {
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
    if (error) {
      console.error('Error during Supabase sign out:', error);
    }
    await logout();
    navigate('/login');
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const toggleProfileDropdown = () => {
    setProfileDropdownOpen(!profileDropdownOpen);
  };

  useEffect(() => {
    if (!profileDropdownOpen) return;
    function handleClickOutside(event) {
      const dropdown = document.getElementById('user-menu-button');
      const menu = document.getElementById('user-menu-dropdown');
      if (
        dropdown && !dropdown.contains(event.target) &&
        menu && !menu.contains(event.target)
      ) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileDropdownOpen]);

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('complaints').insert([
      {
        against: reportAgainst || null,
        subject: reportSubject,
        details: reportDetails,
        name: reportName || null,
        employee_id: user.id,
        anonymous: !reportName
      }
    ]);
    if (error) setReportMsg('Failed to submit report.');
    else setReportMsg('Issue reported.');
    setShowReportModal(false);
    setReportAgainst(''); setReportSubject(''); setReportDetails(''); setReportName('');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to={isAuthenticated ? "/dashboard" : "/"} className="text-xl font-bold text-blue-600">
                Shiftly
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {isAuthenticated && (
                <>
                  <Link to="/dashboard" className="border-transparent text-gray-500 hover:border-blue-500 hover:text-blue-600 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                    Dashboard
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
                    <Link to="/time-off" className="relative border-transparent text-gray-500 hover:border-blue-500 hover:text-blue-600 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                      Time Off
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
              <button type="button" className="relative mr-4 focus:outline-none" aria-label="Notifications">
                <svg className="h-6 w-6 text-gray-500 hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadMessages > 0 && (
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white bg-red-500"></span>
                )}
              </button>
            )}
            {isAuthenticated ? (
              <div className="ml-3 relative">
                <div>
                  <button
                    type="button"
                    className="bg-white rounded-full flex text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    id="user-menu-button"
                    aria-expanded="false"
                    aria-haspopup="true"
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
                </div>
                {profileDropdownOpen && (
                  <div
                    id="user-menu-dropdown"
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                    tabIndex="-1"
                  >
                    <div className="block px-4 py-2 text-sm text-gray-700" role="menuitem">
                      Signed in as <strong>{user?.preferred_name || user?.first_name || user?.username || user?.email}</strong>
                    </div>
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                      tabIndex="-1"
                    >
                      My Profile
                    </Link>
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                      tabIndex="-1"
                    >
                      Report Issue
                    </button>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                      tabIndex="-1"
                      id="user-menu-item-2"
                    >
                      Sign out
                    </button>
                  </div>
                )}
                {/* Report Issue Modal */}
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
              </div>
            ) : (
              <div className="flex space-x-4">
                <Link to="/login" className="text-gray-500 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">
                  Login
                </Link>
              </div>
            )}
          </div>
          <div className="flex items-center sm:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-controls="mobile-menu"
              aria-expanded="false"
              onClick={toggleMobileMenu}
            >
              <span className="sr-only">Open main menu</span>
              <svg className={`${mobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <svg className={`${mobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;