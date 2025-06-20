// useAuth.js
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to set cookie with expiry
  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
  }

  // Helper to get cookie
  function getCookie(name) {
    return document.cookie.split('; ').reduce((r, v) => {
      const parts = v.split('=');
      return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
  }

  // On mount, check for cookie if no localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("shiftly_user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      // Fetch employee record to get latest role_id and other fields
      (async () => {
        const { data: empData, error: empError } = await supabase
          .from("employee")
          .select("*")
          .eq("email", parsedUser.email)
          .single();
        let mergedUser = parsedUser;
        if (!empError && empData) {
          mergedUser = { ...parsedUser, ...empData };
          setUser(mergedUser);
          setIsAuthenticated(true);
          setIsLoading(false);
          localStorage.setItem("shiftly_user", JSON.stringify(mergedUser));
        } else {
          // If no employee record, fallback to parsedUser
          setUser(parsedUser);
          setIsAuthenticated(true);
          setIsLoading(false);
        }
      })();
      return;
    }
    // Check cookie for persistent login
    const cookieUser = getCookie("shiftly_user");
    if (cookieUser) {
      try {
        const parsedUser = JSON.parse(cookieUser);
        (async () => {
          const { data: empData, error: empError } = await supabase
            .from("employee")
            .select("*")
            .eq("email", parsedUser.email)
            .single();
          let mergedUser = parsedUser;
          if (!empError && empData) {
            mergedUser = { ...parsedUser, ...empData };
            setUser(mergedUser);
            setIsAuthenticated(true);
            localStorage.setItem("shiftly_user", JSON.stringify(mergedUser));
          } else {
            setUser(parsedUser);
            setIsAuthenticated(true);
          }
        })();
      } catch {}
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password, keepLoggedIn = false) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Login failed:", error.message);
      return false;
    }

    let user = data.user;

    // Fetch employee record to get role_id and other fields
    const { data: empData, error: empError } = await supabase
      .from("employee")
      .select("*")
      .eq("email", email)
      .single();

    if (!empError && empData) {
      user = { ...user, ...empData };
    }

    setUser(user);
    setIsAuthenticated(true);
    localStorage.setItem("shiftly_user", JSON.stringify(user));
    if (keepLoggedIn) {
      setCookie("shiftly_user", JSON.stringify(user), 60); // 60 days
    } else {
      setCookie("shiftly_user", "", -1); // Remove cookie if not set
    }
    return true;
  };

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("shiftly_user");
    setCookie("shiftly_user", "", -1);
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
