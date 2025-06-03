import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import InputField from "../components/InputField";

export default function ResetPasswordForm() {
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-md max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-4 text-center text-gray-700">Reset Password</h2>
      {error && <div className="mb-4 p-2 bg-red-50 text-red-500 border border-red-200 rounded text-sm">{error}</div>}
      {success && <div className="mb-4 p-2 bg-green-50 text-green-700 border border-green-200 rounded text-sm">{success}</div>}
      <InputField
        label="New Password"
        type="password"
        name="password"
        value={form.password}
        onChange={handleChange}
        required
      />
      <InputField
        label="Confirm New Password"
        type="password"
        name="confirmPassword"
        value={form.confirmPassword}
        onChange={handleChange}
        required
      />
      <button
        type="submit"
        disabled={isLoading}
        className={`w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
      >
        {isLoading ? "Updating..." : "Reset Password"}
      </button>
    </form>
  );
}
