import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * A wrapper component that redirects to the login page if the user is not authenticated.
 * For demo purposes, this is a simplified version that allows access more easily.
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  console.log('ProtectedRoute check:', { isAuthenticated, user, path: location.pathname });

  // For demo purposes, we'll be more permissive
  // Check authentication from localStorage as a fallback
  const storedUser = localStorage.getItem('staffeasy_user');
  const isLocallyAuthenticated = !!storedUser;

  // If authenticated by any means, allow access
  if (isAuthenticated || isLocallyAuthenticated) {
    return children;
  }

  // Otherwise redirect to login
  console.log('Not authenticated, redirecting to login');
  return <Navigate to="/login" state={{ from: location.pathname }} replace />;
};

export default ProtectedRoute;