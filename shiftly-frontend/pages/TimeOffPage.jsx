import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { approveEmployeeRequest, rejectEmployeeRequest } from "../utils/requestHandler";

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
      // Fetch pending time-off requests from employee_request (not time_off_requests!)
      // Only those with request_type = 'availability' and request.start_date & request.end_date (i.e., time-off)
      const { data, error } = await supabase
        .from("employee_request")
        .select("request_id, employee_id, request, employees(name)")
        .eq("request_type", "availability");
      if (error) {
        console.error("Error fetching time-off requests:", error);
        setError("Failed to load time-off requests.");
      } else {
        // Only show requests that are time-off (have start_date and end_date)
        const filtered = (data || []).filter(
          (r) => r.request && r.request.start_date && r.request.end_date
        );
        setRequests(filtered);
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

  // Approve a time-off request using the centralized handler:
  const handleApprove = async (requestId, employeeId) => {
    try {
      const result = await approveEmployeeRequest(requestId);
      if (!result.success) {
        showNotification(result.error || "Failed to approve request.", "error");
        return;
      }
      showNotification("Time-off request approved.", "success");
      setRequests((prev) => prev.filter((r) => r.request_id !== requestId));
    } catch (err) {
      console.error("Unexpected error approving request:", err);
      showNotification("Unexpected error.", "error");
    }
  };

  // Reject a time-off request using the centralized handler:
  const handleReject = async (requestId, employeeId) => {
    try {
      const result = await rejectEmployeeRequest(requestId);
      if (!result.success) {
        showNotification(result.error || "Failed to reject request.", "error");
        return;
      }
      showNotification("Time-off request rejected.", "success");
      setRequests((prev) => prev.filter((r) => r.request_id !== requestId));
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
              <tr key={req.request_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 border-b">{req.employee_id}</td>
                <td className="px-4 py-3 border-b">
                  {req.employees && req.employees.name ? req.employees.name : "N/A"}
                </td>
                <td className="px-4 py-3 border-b">{req.request.reason || "N/A"}</td>
                <td className="px-4 py-3 border-b space-x-2">
                  <button
                    onClick={() => handleApprove(req.request_id, req.employee_id)}
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(req.request_id, req.employee_id)}
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
