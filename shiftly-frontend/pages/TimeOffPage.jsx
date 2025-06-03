import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";

const TimeOffPage = () => {
  const { isAuthenticated, user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Notification state for displaying messages on the website
  const [notification, setNotification] = useState({ message: "", type: "" });

  useEffect(() => {
    if (!isAuthenticated || (user.role !== "manager" && user.role !== "admin")) {
      setLoading(false);
      return;
    }
    fetchTimeOffRequests();
  }, [isAuthenticated, user]);

  const fetchTimeOffRequests = async () => {
    try {
      setLoading(true);
      // Select columns without extra quotes and join the employee's name.
      const { data, error } = await supabase
        .from("time_off_requests")
        .select("id, employee_id, reason, timeoff_requested, employees(name)")
        .eq("timeoff_requested", true);
      if (error) {
        console.error("Error fetching time-off requests:", error);
        setError("Failed to load time-off requests.");
      } else {
        setRequests(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching requests:", err);
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to show notifications for 3 seconds.
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: "", type: "" }), 3000);
  };

  // Approve a time-off request:
  const handleApprove = async (requestId, employeeId) => {
    try {
      // Update the time_off_requests row to mark it as processed (set to false)
      const { error: reqError } = await supabase
        .from("time_off_requests")
        .update({ timeoff_requested: false })
        .eq("id", requestId);
      if (reqError) {
        console.error("Error approving time-off request:", reqError);
        showNotification("Failed to approve request.", "error");
        return;
      }

      // Update the employee record:
      // Update the column "time_off_requests" in your employees table to "approved".
      const { error: empError } = await supabase
        .from("employees")
        .update({ time_off_requests: "approved" })
        .eq("id", employeeId);
      if (empError) {
        console.error("Error updating employee record:", empError);
        showNotification("Failed to update employee record.", "error");
        return;
      }

      showNotification("Time-off request approved.", "success");
      // Remove the processed request from the list.
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error("Unexpected error approving request:", err);
      showNotification("Unexpected error.", "error");
    }
  };

  // Reject a time-off request:
  const handleReject = async (requestId, employeeId) => {
    try {
      // Update the time_off_requests row to mark it as processed (set to false)
      const { error: reqError } = await supabase
        .from("time_off_requests")
        .update({ timeoff_requested: false })
        .eq("id", requestId);
      if (reqError) {
        console.error("Error rejecting time-off request:", reqError);
        showNotification("Failed to reject request.", "error");
        return;
      }

      // Update the employee record: set time_off_requests to null.
      const { error: empError } = await supabase
        .from("employees")
        .update({ time_off_requests: null })
        .eq("id", employeeId);
      if (empError) {
        console.error("Error updating employee record:", empError);
        showNotification("Failed to update employee record.", "error");
        return;
      }

      showNotification("Time-off request rejected.", "success");
      // Remove the processed request from the list.
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error("Unexpected error rejecting request:", err);
      showNotification("Unexpected error.", "error");
    }
  };

  if (!isAuthenticated || (user.role !== "manager" && user.role !== "admin")) {
    return (
      <div className="p-6 text-red-500 text-center">
        Access Denied: Managers Only
      </div>
    );
  }

  if (loading) {
    return <div className="p-6">Loading time-off requests...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Notification Banner */}
      {notification.message && (
        <div
          className={`mb-4 p-3 rounded ${
            notification.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {notification.message}
        </div>
      )}

      <h1 className="text-3xl font-bold mb-6">Time-Off Requests</h1>
      {requests.length === 0 ? (
        <p>No pending time-off requests.</p>
      ) : (
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-gray-600 text-left border-b">Employee ID</th>
              <th className="px-4 py-3 text-gray-600 text-left border-b">Employee Name</th>
              <th className="px-4 py-3 text-gray-600 text-left border-b">Reason</th>
              <th className="px-4 py-3 text-gray-600 text-left border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 border-b">{req.employee_id}</td>
                <td className="px-4 py-3 border-b">
                  {req.employees && req.employees.name ? req.employees.name : "N/A"}
                </td>
                <td className="px-4 py-3 border-b">{req.reason || "N/A"}</td>
                <td className="px-4 py-3 border-b space-x-2">
                  <button
                    onClick={() => handleApprove(req.id, req.employee_id)}
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(req.id, req.employee_id)}
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default TimeOffPage;
