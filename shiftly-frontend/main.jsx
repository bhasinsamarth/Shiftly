// src/main.jsx
import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

// Core components that are needed immediately
import App from "./App";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPageWrapper";
import SetupAccountPage from "./pages/SetupAccountPage";

// Context providers (needed immediately)
import { AuthProvider } from "./context/AuthContext";
import { LocationProvider } from "./context/LocationContext";
import ProtectedRoute from "./components/ProtectedRoute";

// React Query
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Lazy-loaded components (loaded only when needed)
const Employees = lazy(() => import("./pages/Employees"));
const AddEmployee = lazy(() => import("./pages/AddEmployee"));
const EditEmployee = lazy(() => import("./pages/EditEmployee"));
const EmployeeRequests = lazy(() => import("./pages/EmployeeRequests"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const FetchSchedule = lazy(() => import("./pages/FetchSchedule"));
const SchedulePlanner = lazy(() => import("./pages/SchedulePlanner"));
const ChangeAvailabity = lazy(() => import("./pages/ChangeAvailabity"));
const ChatRoomPage = lazy(() => import("./pages/ChatRoomPage"));
const ManagerStorePage = lazy(() => import("./pages/MyStore"));
const ClockDashboard = lazy(() => import("./pages/ClockDashboard"));
const BulkStoreGeocoding = lazy(() => import("./pages/BulkStoreGeocoding"));
const TimeOffRequestPage = lazy(() => import("./pages/TimeOffRequestPage"));
const Timecards = lazy(() => import("./pages/TimeCard"));
const ChatPage = lazy(() => import("./pages/ChatPage"));

// Create a single React Query client
const queryClient = new QueryClient();

// Loading component for lazy-loaded routes
const RouteLoader = ({ children }) => (
  <Suspense fallback={
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  }>
    {children}
  </Suspense>
);

function AppWithRoutes() {
  
  return (
    <App>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        
        {/* Dashboard - accessible to all authenticated users with role-based UI */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        
        {/* Admin/Owner only routes */}
        <Route path="/employees" element={<ProtectedRoute allowedRoles={[1, 2]}><RouteLoader><Employees /></RouteLoader></ProtectedRoute>} />
        <Route path="/add-employee" element={<ProtectedRoute allowedRoles={[1, 2]}><RouteLoader><AddEmployee /></RouteLoader></ProtectedRoute>} />
        <Route path="/edit-employee/:id" element={<ProtectedRoute allowedRoles={[1, 2]}><RouteLoader><EditEmployee /></RouteLoader></ProtectedRoute>} />
        <Route path="/bulk-geocoding" element={<ProtectedRoute allowedRoles={[1, 2]}><RouteLoader><BulkStoreGeocoding /></RouteLoader></ProtectedRoute>} />
        
        {/* Manager only routes */}
        <Route path="/schedules" element={<ProtectedRoute allowedRoles={[3]}><RouteLoader><SchedulePlanner /></RouteLoader></ProtectedRoute>} />
        <Route path="/employee-requests" element={<ProtectedRoute allowedRoles={[3]}><RouteLoader><EmployeeRequests /></RouteLoader></ProtectedRoute>} />
        <Route path="/my-store" element={<ProtectedRoute allowedRoles={[3]}><RouteLoader><ManagerStorePage /></RouteLoader></ProtectedRoute>} />
        
        {/* Associate only routes */}
        <Route path="/time-off-request" element={<ProtectedRoute allowedRoles={[4, 5, 6]}><RouteLoader><TimeOffRequestPage /></RouteLoader></ProtectedRoute>} />
        <Route path="/requests" element={<ProtectedRoute allowedRoles={[4, 5, 6]}><div className="p-4 text-center">Notifications page - Coming soon!</div></ProtectedRoute>} />
        
        {/* Routes accessible to managers and admin/owners */}
        <Route path="/timecards" element={<ProtectedRoute allowedRoles={[1, 2, 3]}><RouteLoader><Timecards /></RouteLoader></ProtectedRoute>} />
        
        {/* Routes accessible to all employee roles (managers and associates) */}
        <Route path="/fetch-schedule" element={<ProtectedRoute allowedRoles={[3, 4, 5, 6]}><RouteLoader><FetchSchedule /></RouteLoader></ProtectedRoute>} />
        <Route path="/clock" element={<ProtectedRoute allowedRoles={[1, 2, 3, 4, 5, 6]}><LocationProvider><RouteLoader><ClockDashboard /></RouteLoader></LocationProvider></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute allowedRoles={[1, 2, 3, 4, 5, 6]}><RouteLoader><ChatPage /></RouteLoader></ProtectedRoute>} />
        <Route path="/chat/room/:roomId" element={<ProtectedRoute allowedRoles={[1, 2, 3, 4, 5, 6]}><RouteLoader><ChatRoomPage /></RouteLoader></ProtectedRoute>} />
        
        {/* General authenticated routes */}
        <Route path="/profile" element={<ProtectedRoute><RouteLoader><ProfilePage /></RouteLoader></ProtectedRoute>} />
        <Route path="/change-availability" element={<ProtectedRoute><RouteLoader><ChangeAvailabity /></RouteLoader></ProtectedRoute>} />
        
        {/* Public routes needs the token rendering */}
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
    <QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><AppWithRoutes /></AuthProvider></BrowserRouter></QueryClientProvider></React.StrictMode>
);
