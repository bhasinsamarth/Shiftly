// src/features/auth/LoginForm.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import InputField from "../../components/InputField";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../../supabaseClient"; 
import { useAuth } from "../../context/AuthContext";

export default function LoginForm() {
  const [form, setForm] = useState({ employeeId: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const { login, user } = useAuth();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError("");
  };

  const handleKeepLoggedInChange = (e) => {
    setKeepLoggedIn(e.target.checked);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { employeeId, password } = form;

    if (!employeeId || !password) {
      setError("Employee ID and password are required");
      return;
    }

    if (employeeId.length !== 7 || !/^\d+$/.test(employeeId)) {
      setError("Employee ID must be exactly 7 digits.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // 1) Lookup email by employee_id
      const { data, error: dbError } = await supabase
        .from("employee")
        .select("email")
        .eq("employee_id", employeeId)
        .single();

      if (dbError || !data) {
        setError("Invalid Employee ID or password.");
        setIsLoading(false);
        return;
      }

      // 2) Attempt login
      const loginSuccess = await login(data.email, password, keepLoggedIn);
      if (!loginSuccess) {
        setError("Invalid Employee ID or password.");
        setIsLoading(false);
        return;
      }

      // 3) Persist user in localStorage for fallback
      if (user) {
        localStorage.setItem("shiftly_user", JSON.stringify(user));
      }

      // 4) Redirect back to intended page
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-md">
      <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-center text-gray-700">
        Login to Shiftly
      </h2>

      {error && (
        <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-red-50 text-red-500 border border-red-200 rounded text-xs sm:text-sm">
          {error}
        </div>
      )}

      <InputField
        label="Employee ID"
        type="text"
        name="employeeId"
        value={form.employeeId}
        onChange={handleChange}
        placeholder="7-digit number"
        required
      />

      <div className="mb-3 sm:mb-4 relative">
        <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          value={form.password}
          onChange={handleChange}
          required
          className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent pr-16"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none p-1"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff size={18} className="sm:w-[18px] sm:h-[18px] w-4 h-4" /> : <Eye size={18} className="sm:w-[18px] sm:h-[18px] w-4 h-4" />}
        </button>
      </div>

      <div className="flex items-center mb-3 sm:mb-4">
        <input
          id="keepLoggedIn"
          type="checkbox"
          checked={keepLoggedIn}
          onChange={handleKeepLoggedInChange}
          className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4"
        />
        <label htmlFor="keepLoggedIn" className="text-xs sm:text-sm text-gray-700">
          Keep me logged in for 60 days
        </label>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={`w-full mt-3 sm:mt-4 bg-blue-600 text-white py-2.5 sm:py-2 px-4 rounded text-sm hover:bg-blue-700 transition ${
          isLoading ? "opacity-70 cursor-not-allowed" : ""
        }`}
      >
        {isLoading ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}

