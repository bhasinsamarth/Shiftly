import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth as useAuthHook } from '../hooks/useAuth';
import { AuthService } from '../services/apiClient.js';

// Create the authentication context
export const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Auth Provider component that wraps the app
export const AuthProvider = ({ children }) => {
  const auth = useAuthHook();
  // State to hold the custom user record from the "users" table.
  const [dbUser, setDbUser] = useState(null);

  // Whenever the auth.user is available, fetch the corresponding user record from the API.
  useEffect(() => {
    const fetchDbUser = async () => {
      if (auth.user && auth.user.email) {
        try {
          const data = await AuthService.getProfile();
          setDbUser(data);
        } catch (error) {
          console.error("Error fetching db user:", error);
          setDbUser(null);
        }
      }
    };

    fetchDbUser();
  }, [auth.user]);

  // Compute isAdmin based on the custom user record.
  const isAdmin = dbUser?.role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        dbUser,
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
        isAdmin,
        login: auth.login,
        logout: auth.logout
      }}
    >
      {auth.isLoading ? (
        // Loading spinner while auth is loading.
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
