// App.jsx
import React from "react";
import { createBrowserRouter, RouterProvider, Routes, Route } from "react-router-dom";
import Navbar from "./navbar";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import AddEmployee from "./pages/AddEmployee";
import EditEmployee from "./pages/EditEmployee";
import TeamsPage from "./pages/TeamsPage";
import TimeOffPage from "./pages/TimeOffPage";

// 🔐 Auth Pages
import ForgotPassword from "./pages/ForgotPasswordPage"; // Ensure correct path

export default function App() {
  return (
    <>
      <Navbar />
      <div className="mt-16 p-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/add-employee" element={<AddEmployee />} />
          <Route path="/edit-employee/:id" element={<EditEmployee />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/time-off" element={<TimeOffPage />} />

          {/* 🔐 Forgot Password */}
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* 🚫 404 Page */}
          <Route path="*" element={
            <div className="text-center py-20">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Page Not Found</h2>
              <p className="text-gray-600 mb-8">The page you're looking for doesn't exist or has been moved.</p>
              <a href="/" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-md transition-colors">
                Go Home
              </a>
            </div>
          } />
        </Routes>
      </div>
    </>
  );
}