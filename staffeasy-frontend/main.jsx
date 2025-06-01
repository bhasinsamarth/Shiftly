import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./navbar.jsx";
import "./index.css";

// Import page components
import Dashboard from "./pages/Dashboard.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import Employees from "./pages/Employees.jsx";
import AddEmployee from "./pages/AddEmployee.jsx";
import EditEmployee from "./pages/EditEmployee.jsx";
import TeamsPage from "./pages/TeamsPage.jsx";
import TimeOffPage from "./pages/TimeOffPage.jsx";

// Auth context provider
import { AuthProvider } from "./context/AuthContext.jsx";

// App component with routing
const App = () => {
  return (
    <div className="app min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="container mx-auto p-4 pt-6 flex-grow">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />     
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Protected Routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/add-employee" element={<AddEmployee />} />
          <Route path="/edit-employee/:id" element={<EditEmployee />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/time-off" element={<TimeOffPage />} />
          
          {/* Catch-all route for undefined routes */}
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
      </main>
      <footer className="bg-white shadow-inner py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© 2025 StaffEasy. All rights reserved.</p>
          <p className="mt-1">Developed by Tech Titans - Web Dev 2 Project</p>
        </div>
      </footer>
    </div>
  );
};

// Render the application
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);