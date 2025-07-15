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
        
        {/* Dashboard - accessible to all authenticated users with role-based UI */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        
        {/* Admin/Owner only routes */}
        <Route path="/employees" element={<ProtectedRoute allowedRoles={[1, 2]}><Employees /></ProtectedRoute>} />
        <Route path="/add-employee" element={<ProtectedRoute allowedRoles={[1, 2]}><AddEmployee /></ProtectedRoute>} />
        <Route path="/edit-employee/:id" element={<ProtectedRoute allowedRoles={[1, 2]}><EditEmployee /></ProtectedRoute>} />
        <Route path="/bulk-geocoding" element={<ProtectedRoute allowedRoles={[1, 2]}><BulkStoreGeocoding /></ProtectedRoute>} />
        
        {/* Manager only routes */}
        <Route path="/schedules" element={<ProtectedRoute allowedRoles={[3]}><SchedulePlanner /></ProtectedRoute>} />
        <Route path="/employee-requests" element={<ProtectedRoute allowedRoles={[3]}><EmployeeRequests /></ProtectedRoute>} />
        <Route path="/my-store" element={<ProtectedRoute allowedRoles={[3]}><ManagerStorePage /></ProtectedRoute>} />
        
        {/* Associate only routes */}
        <Route path="/time-off-request" element={<ProtectedRoute allowedRoles={[4, 5, 6]}><TimeOffRequestPage /></ProtectedRoute>} />
        <Route path="/requests" element={<ProtectedRoute allowedRoles={[4, 5, 6]}><div className="p-4 text-center">Notifications page - Coming soon!</div></ProtectedRoute>} />
        
        {/* Routes accessible to managers and admin/owners */}
        <Route path="/timecards" element={<ProtectedRoute allowedRoles={[1, 2, 3]}><Timecards /></ProtectedRoute>} />
        
        {/* Routes accessible to all employee roles (managers and associates) */}
        <Route path="/fetch-schedule" element={<ProtectedRoute allowedRoles={[3, 4, 5, 6]}><FetchSchedule /></ProtectedRoute>} />
        <Route path="/clock" element={<ProtectedRoute allowedRoles={[1, 2, 3, 4, 5, 6]}><ClockDashboard /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute allowedRoles={[1, 2, 3, 4, 5, 6]}><Suspense fallback={<div>Loading chat...</div>}><ChatPage /></Suspense></ProtectedRoute>} />
        <Route path="/chat/room/:roomId" element={<ProtectedRoute allowedRoles={[1, 2, 3, 4, 5, 6]}><ChatRoomPage /></ProtectedRoute>} />
        
        {/* General authenticated routes */}
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/change-availability" element={<ProtectedRoute><ChangeAvailabity /></ProtectedRoute>} />
        
        {/* Public routes */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/setup-account" element={<SetupAccountPage />} />


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
