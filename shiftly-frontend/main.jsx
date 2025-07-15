// src/main.jsx
import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

// Core pages & components
import App from "./App";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import AddEmployee from "./pages/AddEmployee";
import EditEmployee from "./pages/EditEmployee";
import EmployeeRequests from "./pages/EmployeeRequests";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPageWrapper";
import SetupAccountPage from "./pages/SetupAccountPage";
import ProfilePage from "./pages/ProfilePage";
import FetchSchedule from "./pages/FetchSchedule";
import SchedulePlanner from "./pages/SchedulePlanner";
import ChangeAvailabity from "./pages/ChangeAvailabity";
import ChatRoomPage from "./pages/ChatRoomPage";
import ManagerStorePage from "./pages/MyStore";
import ClockDashboard from "./pages/ClockDashboard";
import BulkStoreGeocoding from "./pages/BulkStoreGeocoding";

import TimeOffRequestPage from "./pages/TimeOffRequestPage";
import Timecards from "./pages/TimeCard";

// Context providers
import { AuthProvider } from "./context/AuthContext";
import { LocationProvider } from "./context/LocationContext";
import ProtectedRoute from "./components/ProtectedRoute";

// React Query
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Lazy-loaded ChatPage
const ChatPage = lazy(() => import("./pages/ChatPage"));

// Create a single React Query client
const queryClient = new QueryClient();

function AppWithRoutes() {
  
  return (
    <App>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/schedules" element={<ProtectedRoute><SchedulePlanner /></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
        <Route path="/add-employee" element={<ProtectedRoute><AddEmployee /></ProtectedRoute>} />
        <Route path="/edit-employee/:id" element={<ProtectedRoute><EditEmployee /></ProtectedRoute>} />
        <Route path="/employee-requests" element={<ProtectedRoute><EmployeeRequests /></ProtectedRoute>} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/setup-account" element={<SetupAccountPage />} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/fetch-schedule" element={<ProtectedRoute><FetchSchedule /></ProtectedRoute>} />
        <Route path="/change-availability" element={<ProtectedRoute><ChangeAvailabity /></ProtectedRoute>} />
        <Route path="/my-store" element={<ProtectedRoute><ManagerStorePage /></ProtectedRoute>} />
        <Route path="/clock" element={<ProtectedRoute><ClockDashboard /></ProtectedRoute>} />
        <Route path="/bulk-geocoding" element={<ProtectedRoute><BulkStoreGeocoding /></ProtectedRoute>} />
        <Route path="/timecards" element={<ProtectedRoute><Timecards /></ProtectedRoute>} />
        <Route path="/time-off-request" element={<ProtectedRoute><TimeOffRequestPage /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><Suspense fallback={<div>Loading chat...</div>}><ChatPage /></Suspense></ProtectedRoute>} />
        <Route path="/chat/room/:roomId" element={<ProtectedRoute><ChatRoomPage /></ProtectedRoute>} />


        {/* Catch-all route for 404 */}
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
    </App>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Provide the React Query client */}
    <QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><LocationProvider><AppWithRoutes /></LocationProvider></AuthProvider></BrowserRouter></QueryClientProvider></React.StrictMode>
);
