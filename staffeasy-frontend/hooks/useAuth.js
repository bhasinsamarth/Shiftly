// useAuth.js
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, attempt to retrieve user info from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("staffeasy_user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Login failed:", error.message);
    return false;
  }

  const user = data.user;

  setUser(user);
  setIsAuthenticated(true);
  localStorage.setItem("staffeasy_user", JSON.stringify(user));

  return true;
};

  const logout = async () => {
    // Clear state and local storage
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("staffeasy_user");
    return true;
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
};

export default useAuth;
