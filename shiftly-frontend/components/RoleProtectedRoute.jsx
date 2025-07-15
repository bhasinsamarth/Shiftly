// components/RoleProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { useAuth } from '../context/AuthContext';

/**
 * A wrapper component that redirects to the dashboard if the user doesn't have the required role.
 * @param {Object} props
 * @param {Array} props.allowedRoleIds - Array of role IDs that are allowed to access the route
 * @param {React.ReactNode} props.children - The child components to render if access is granted
 */
const RoleProtectedRoute = ({ allowedRoleIds, children }) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasAccess, isLoading: roleLoading } = useRoleAccess(allowedRoleIds);
  const location = useLocation();

  const isLoading = authLoading || roleLoading;

  // While authentication or role checking is in progress
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // If authenticated but doesn't have the required role
  if (!hasAccess) {
    return (
      <Navigate
        to="/dashboard"
        state={{ 
          from: location,
          accessDenied: true,
          message: "You don't have permission to access this page."
        }}
        replace
      />
    );
  }

  // If authenticated and has the required role
  return children;
};

export default RoleProtectedRoute;
