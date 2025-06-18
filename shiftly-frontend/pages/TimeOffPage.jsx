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
    if (!isAuthenticated || user.role_id !== 3) {
      setLoading(false);
      return;
    }
    fetchTimeOffRequests();
  }, [isAuthenticated, user]);

  const fetchTimeOffRequests = async () => {
    try {
      setLoading(true);
      // Fetch requests with request_type = 'time-off' from employee_request
      const { data, error } = await supabase
        .from("employee_request")
        .select("request_id, employee_id, request")
        .eq("request_type", "time-off");
      if (error) {
        console.error("Error fetching time-off requests:", error);
        setError("Failed to load time-off requests.");
      } else {
        // Only show requests that have start_date and end_date in the request JSON
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

  if (!isAuthenticated || user.role_id !== 3) {
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
          className={`mb-4 p-3 rounded ${notification.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
        >
          {notification.message}
        </div>
      )}

      <h1 className="text-3xl font-bold mb-8 text-blue-700 text-center">Time-Off Requests</h1>
      {requests.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500 text-lg">
          No pending time-off requests.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-md">
            <thead className="bg-blue-50">
              <tr>
                <th className="px-4 py-3 text-blue-800 text-left border-b font-semibold">Employee ID</th>
                <th className="px-4 py-3 text-blue-800 text-left border-b font-semibold">Reason</th>
                <th className="px-4 py-3 text-blue-800 text-left border-b font-semibold">Start Date</th>
                <th className="px-4 py-3 text-blue-800 text-left border-b font-semibold">End Date</th>
                <th className="px-4 py-3 text-blue-800 text-left border-b font-semibold">Number of Days</th>
                <th className="px-4 py-3 text-blue-800 text-left border-b font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const start = req.request.start_date ? new Date(req.request.start_date) : null;
                const end = req.request.end_date ? new Date(req.request.end_date) : null;
                let numDays = "N/A";
                if (start && end && !isNaN(start) && !isNaN(end)) {
                  numDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
                }
                return (
                  <tr key={req.request_id} className="hover:bg-blue-50 transition">
                    <td className="px-4 py-3 border-b text-gray-800">{req.employee_id}</td>
                    <td className="px-4 py-3 border-b text-gray-700">{req.request.reason || "N/A"}</td>
                    <td className="px-4 py-3 border-b text-gray-700">{req.request.start_date || "N/A"}</td>
                    <td className="px-4 py-3 border-b text-gray-700">{req.request.end_date || "N/A"}</td>
                    <td className="px-4 py-3 border-b text-gray-700">{numDays}</td>
                    <td className="px-4 py-3 border-b space-x-2 flex flex-col sm:flex-row gap-2 justify-center items-center">
                      <button
                        onClick={() => handleApprove(req.request_id, req.employee_id)}
                        className="bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 transition font-semibold shadow-sm w-full sm:w-auto"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(req.request_id, req.employee_id)}
                        className="bg-red-600 text-white px-4 py-1.5 rounded-lg hover:bg-red-700 transition font-semibold shadow-sm w-full sm:w-auto"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TimeOffPage;