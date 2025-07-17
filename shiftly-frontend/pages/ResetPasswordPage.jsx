import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Eye, EyeOff } from "lucide-react";

export default function ResetPasswordForm() {

  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.password || !form.confirmPassword) {
      setError("Both fields are required.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: form.password });
      if (updateError) {
        setError(updateError.message);
        setIsLoading(false);
        return;
      }
      // Log out after password reset to clear recovery session
      await supabase.auth.signOut();
      setSuccess("Password updated successfully. Please log in with your new password.");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center py-6 sm:py-8 md:py-12 px-3 sm:px-6 lg:px-8">
      <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-md w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-center text-gray-700">Reset Password</h2>
        {error && <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-red-50 text-red-500 border border-red-200 rounded text-xs sm:text-sm">{error}</div>}
        {success && <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-green-50 text-green-700 border border-green-200 rounded text-xs sm:text-sm">{success}</div>}
        <div className="mb-3 sm:mb-4">
          <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
              required
              className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent pr-10"
            />
            <button
              type="button"
              tabIndex="-1"
              onClick={() => setShowPassword(prev => !prev)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} className="sm:w-[18px] sm:h-[18px] w-4 h-4" /> : <Eye size={18} className="sm:w-[18px] sm:h-[18px] w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="mb-3 sm:mb-4">
          <label htmlFor="confirmPassword" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={handleChange}
              required
              className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent pr-10"
            />
            <button
              type="button"
              tabIndex="-1"
              onClick={() => setShowConfirmPassword(prev => !prev)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none p-1"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff size={18} className="sm:w-[18px] sm:h-[18px] w-4 h-4" /> : <Eye size={18} className="sm:w-[18px] sm:h-[18px] w-4 h-4" />}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full mt-3 sm:mt-4 bg-blue-600 text-white py-2.5 sm:py-2 px-4 rounded text-sm hover:bg-blue-700 transition ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
        >
          {isLoading ? "Updating..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
}
