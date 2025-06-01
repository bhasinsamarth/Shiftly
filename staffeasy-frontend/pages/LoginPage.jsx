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
    <div className="min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Welcome Back</h1>
          <p className="mt-2 text-gray-600">Sign in to access your StaffEasy account</p>
        </div>
        
        <LoginForm />
        
        <p className="text-center text-sm text-gray-600 mt-6">
          Forgot Password?{' '}
          <Link to="/forgot-password"  className="text-blue-600 hover:underline font-medium">
            Reset it here
          </Link>
        </p>
      </div>
    </div>
  );
}