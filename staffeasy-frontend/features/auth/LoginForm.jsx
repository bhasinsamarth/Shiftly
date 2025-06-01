// LoginForm.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import InputField from "../../components/InputField";
import { supabase } from "../../supabaseClient"; 

export default function LoginForm() {
  const [form, setForm] = useState({ employeeId: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
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
      // Step 1: Look up the email from the employees table
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

      const { email } = data;

      console.log("Fetched email for login:", email);

      // Step 2: Use Supabase Auth to sign in with email and password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError("Invalid Employee ID or password.");
        setIsLoading(false);
        return;
      }

      // Success!
      setIsLoading(false);
      navigate("/dashboard");

    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-center text-gray-700">
        Login to StaffEasy
      </h2>
      {error && (
        <div className="mb-4 p-2 bg-red-50 text-red-500 border border-red-200 rounded text-sm">
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
      <InputField
        label="Password"
        type="password"
        name="password"
        value={form.password}
        onChange={handleChange}
        required
      />
      <button
        type="submit"
        disabled={isLoading}
        className={`w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition ${
          isLoading ? "opacity-70 cursor-not-allowed" : ""
        }`}
      >
        {isLoading ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}