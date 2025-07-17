import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import LoginForm from '../features/auth/LoginForm';
import { useAuth } from '../hooks/useAuth';


export default function LoginPage() {
  const { isAuthenticated } = useAuth();
  
  // Redirect if already logged in
  if (isAuthenticated) {
    return <Navigate to="/dashboard" />;
  }
  
  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center py-6 sm:py-8 md:py-12 px-3 sm:px-6 lg:px-8">
      <div className="w-full max-w-xs sm:max-w-sm md:max-w-md">
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Welcome Back</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">Sign in to access your Shiftly account</p>
        </div>
        
        <LoginForm />
        
        <p className="text-center text-xs sm:text-sm text-gray-600 mt-4 sm:mt-6">
          Forgot Password?{' '}
          <Link to="/forgot-password"  className="text-blue-600 hover:underline font-medium">
            Reset it here
          </Link>
        </p>
      </div>
    </div>
  );
}