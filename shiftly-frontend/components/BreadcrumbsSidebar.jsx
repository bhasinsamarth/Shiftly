import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { Menu } from 'lucide-react';

const BreadcrumbsSidebar = ({ toggleSidebar }) => {
    const location = useLocation();
    const pathnames = location.pathname.split('/').filter(Boolean);
    const { user, isAuthenticated, logout } = useAuth();
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [profileImage, setProfileImage] = useState(null);
    const navigate = useNavigate();

    // Add a ref for the profile menu
    const profileMenuRef = React.useRef(null);

    React.useEffect(() => {
        const fetchProfileImage = async () => {
            if (user?.id) {
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
            }
        };
        fetchProfileImage();
    }, [user]);

    // Close dropdown on outside click
    React.useEffect(() => {
        if (!profileDropdownOpen) return;
        function handleClickOutside(event) {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setProfileDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [profileDropdownOpen]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        await logout();
        navigate('/login');
    };

    return (
        <nav className="w-full top-0 left-0 z-50 fixed bg-gray-50 border-b border-gray-200 px-6 py-3 h-16 flex items-center text-sm justify-between">
            <div className="flex items-center">
                <button 
                    onClick={toggleSidebar} 
                    className="mr-3 lg:hidden text-gray-900 hover:text-blue-600 transition-colors p-1"
                    aria-label="Toggle sidebar menu"
                >
                    <Menu size={24} strokeWidth={2.5} />
                </button>
                <ol className="flex items-center space-x-1">
                    <li>
                        <Link to="/" className="text-blue-600 hover:underline font-medium">Shiftly</Link>
                    </li>
                    {pathnames.map((name, idx) => {
                        const routeTo = '/' + pathnames.slice(0, idx + 1).join('/');
                        const label = name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        return (
                            <li key={routeTo} className="flex items-center">
                                <span className="mx-2 text-gray-400">/</span>
                                <Link to={routeTo} className="text-gray-700 hover:text-blue-600">
                                    {label}
                                </Link>
                            </li>
                        );
                    })}
                </ol>
            </div>
            {isAuthenticated && (
                <div className="flex items-center space-x-4 relative">
                    <div
                        className="flex items-center space-x-2 cursor-pointer"
                        onClick={() => setProfileDropdownOpen((open) => !open)}
                    >
                        {profileImage ? (
                            <img src={profileImage} alt="Profile" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                                {user?.username?.charAt(0) || user?.email?.charAt(0) || 'U'}
                            </div>
                        )}
                        <span className="text-sm font-medium text-gray-900">
                            {user?.preferred_name || user?.first_name || user?.username || user?.email}
                        </span>
                    </div>
                    {profileDropdownOpen && (
                        <div className="fixed inset-0 z-50 flex items-start justify-end">
                            <div
                                className="absolute inset-0"
                                onClick={() => setProfileDropdownOpen(false)}
                            />
                            <div
                                ref={profileMenuRef}
                                className="mt-14 mr-6 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1 text-sm min-w-[180px] z-50 relative"
                                onClick={e => e.stopPropagation()}
                            >
                                <Link to="/profile" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">My Profile</Link>
                                <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100">
                                    Sign out
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </nav>
    );
};

export default BreadcrumbsSidebar;
