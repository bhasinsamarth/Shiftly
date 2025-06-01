// src/pages/ForgotPasswordPage.jsx
import React, { useState } from "react";
import { supabase } from "../supabaseClient"; // Adjust the import path as needed
import { useNavigate } from "react-router-dom"; // If you need to navigate after success


export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState(""); // Can be email or employee ID
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      let email = identifier.trim();

      // If input looks like an employee ID (7-digit number), look up the email
      if (/^\d{7}$/.test(identifier)) {
        const { data, error: dbError } = await supabase
          .from("employee")
          .select("email")
          .eq("employee_id", identifier)
          .single();

        if (dbError || !data) {
          setError("No user found with that Employee ID.");
          setIsLoading(false);
          return;
        }

        email = data.email;
      }

      // Send password reset link via Supabase Auth
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`, // Where to redirect after clicking the email link
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      // Success!
      setSuccess(`A password reset link has been sent to ${email}. Please check your inbox.`);
    } catch (err) {
      console.error("Forgot password error:", err);
      setError("Something went wrong. Please try again.");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-700">Forgot Password</h2>
        <p className="text-sm text-gray-600 text-center mb-6">Enter your Employee ID or Email below.</p>

        {error && (
          <div className="mb-4 p-2 bg-red-50 text-red-500 border border-red-200 rounded text-sm">
            {error}
          </div>
        )}

        {success ? (
          <div className="p-4 bg-green-50 text-green-700 rounded-md text-sm text-center">
            {success}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-md">
            <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">
              Employee ID or Email
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. 1000001 or user@example.com"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition ${
                isLoading ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {isLoading ? "Sending Reset Link..." : "Send Reset Link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}