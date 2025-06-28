import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

// Import layout and pages
import App from "./App";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import AddEmployee from "./pages/AddEmployee";
import EditEmployee from "./pages/EditEmployee";
import TeamsPage from "./pages/TeamsPage";
import EmployeeRequests from "./pages/EmployeeRequests";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPageWrapper";
import SetupAccountPage from "./pages/SetupAccountPage";
import ProfilePage from "./pages/ProfilePage";
import FetchSchedule from "./pages/FetchSchedule";
import SchedulePlanner from "./pages/SchedulePlanner";
import ChangeAvailabity from "./pages/ChangeAvailabity";
import ManagerStorePage from "./pages/MyStore";
import TimeOffPage from "./pages/TimeOffPage";
import ClockDashboard from "./pages/ClockDashboard";
import BulkStoreGeocoding from "./pages/BulkStoreGeocoding";

// Context providers
import { AuthProvider } from "./context/AuthContext";
import { LocationProvider } from "./context/LocationContext";
import ProtectedRoute from "./components/ProtectedRoute";

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
        <Route path="/teams" element={<ProtectedRoute><TeamsPage /></ProtectedRoute>} />
        <Route path="/employee-requests" element={<ProtectedRoute><EmployeeRequests /></ProtectedRoute>} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/setup-account" element={<SetupAccountPage />} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/fetch-schedule" element={<ProtectedRoute><FetchSchedule /></ProtectedRoute>} />
        <Route path="/change-availability" element={<ProtectedRoute><ChangeAvailabity /></ProtectedRoute>} />
        <Route path="/my-store" element={<ProtectedRoute><ManagerStorePage /></ProtectedRoute>} />
        <Route path="/time-off" element={<ProtectedRoute><TimeOffPage /></ProtectedRoute>} />
        <Route path="/clock" element={<ProtectedRoute><ClockDashboard /></ProtectedRoute>} />
        <Route path="/bulk-geocoding" element={<ProtectedRoute><BulkStoreGeocoding /></ProtectedRoute>} />

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

// Render the application
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LocationProvider>
          <AppWithRoutes />
        </LocationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
