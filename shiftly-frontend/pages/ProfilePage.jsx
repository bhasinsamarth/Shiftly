import React from "react";
import { useAuth } from "../context/AuthContext";

const ProfilePage = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg text-gray-600">You must be signed in to view your profile.</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-blue-700">My Profile</h1>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <span className="font-semibold text-gray-700">Preferred Name: </span>
          {user.preferred_name || <span className="text-gray-400">Not set</span>}
        </div>
        <div>
          <span className="font-semibold text-gray-700">First Name: </span>
          {user.first_name || <span className="text-gray-400">Not set</span>}
        </div>
        <div>
          <span className="font-semibold text-gray-700">Last Name: </span>
          {user.last_name || <span className="text-gray-400">Not set</span>}
        </div>
        <div>
          <span className="font-semibold text-gray-700">Email: </span>
          {user.email}
        </div>
        <div>
          <span className="font-semibold text-gray-700">Employee ID: </span>
          {user.employee_id || <span className="text-gray-400">Not set</span>}
        </div>
        <div>
          <span className="font-semibold text-gray-700">Role: </span>
          {user.role || <span className="text-gray-400">Not set</span>}
        </div>
        {/* Add more fields as needed */}
      </div>
    </div>
  );
};

export default ProfilePage;
