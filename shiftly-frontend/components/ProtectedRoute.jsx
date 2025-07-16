// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * A wrapper component that redirects to the login page if the user is not authenticated
 * and to the dashboard with an access denied message if the user doesn't have the required role.
 * Falls back to localStorage-based auth, shows a loading state, 
 * and preserves the original location in state for post-login redirection.
 */
const ProtectedRoute = ({ children, allowedRoles = null }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Deserialize any user stored in localStorage
  let storedUser = null;
  try {
    storedUser = JSON.parse(localStorage.getItem('shiftly_user') || 'null');
  } catch (e) {
    storedUser = null;
  }
  const isLocallyAuthenticated = !!storedUser;


  // While your auth provider is resolving (e.g. checking a token), show a loader
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading your session…</p>
      </div>
    );
  }

  // If neither context nor localStorage indicates a valid session, redirect
  if (!isAuthenticated && !isLocallyAuthenticated) {
    console.log('Not authenticated, redirecting to login');
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // Role-based access control
  if (allowedRoles) {
    const currentUser = user || storedUser;
    const userRole = currentUser?.role_id;


    if (!userRole || !allowedRoles.includes(userRole)) {
      console.log('Access denied - Role check failed:', {
        userRole,
        allowedRoles,
        path: location.pathname,
      });
      console.log('Access denied, redirecting to dashboard with message');
      return (
        <Navigate
          to="/dashboard"
          state={{
            accessDenied: true,
            message: `You do not have permission to access ${location.pathname}. Please contact your administrator if you believe this is an error.`
          }}
          replace
        />
      );
    }
  }

  // Otherwise render the protected child
  return children;
};

export default ProtectedRoute;
