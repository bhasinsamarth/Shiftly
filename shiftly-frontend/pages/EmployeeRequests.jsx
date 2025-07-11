import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { approveEmployeeRequest, rejectEmployeeRequest, fetchPendingAvailabilityRequests, fetchPendingTimeOffRequests } from "../utils/requestHandler";

const EmployeeRequests = () => {
  const { isAuthenticated, user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [activeTab, setActiveTab] = useState("time-off");
  const [modalData, setModalData] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || user.role_id !== 3) {
      setLoading(false);
      return;
    }
    fetchRequests();
  }, [isAuthenticated, user, activeTab]);

  const fetchEmployeeName = async (employeeId) => {
    try {
      const { data, error } = await supabase
        .from("employee")
        .select("first_name, last_name, preferred_name")
        .eq("employee_id", employeeId)
        .single();

      if (error) {
        console.error("Error fetching employee name:", error);
        return "Unknown";
      }

      const { first_name, last_name, preferred_name } = data;
      const fullName = `${last_name}, ${first_name}`;
      return preferred_name ? `${fullName} (${preferred_name})` : fullName;
    } catch (err) {
      console.error("Unexpected error fetching employee name:", err);
      return "Unknown";
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      let data;
      if (activeTab === "time-off") {
        data = await fetchPendingTimeOffRequests();
      } else {
        data = await fetchPendingAvailabilityRequests();
      }

      if (data) {
        const requestsWithNames = await Promise.all(
          data.map(async (req) => {
            const employeeName = await fetchEmployeeName(req.employee_id);
            console.log(`Fetched name for employee ID ${req.employee_id}: ${employeeName}`); // Debug log
            return { ...req, employee_name: employeeName };
          })
        );
        setRequests(requestsWithNames);
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.error("Unexpected error fetching requests:", err);
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: "", type: "" }), 3000);
  };

  const handleApprove = async (requestId, employeeId) => {
    try {
      const result = await approveEmployeeRequest(requestId);
      if (!result.success) {
        showNotification(result.error || "Failed to approve request.", "error");
        return;
      }
      showNotification("Request approved.", "success");
      setRequests((prev) => prev.filter((r) => r.request_id !== requestId));
    } catch (err) {
      console.error("Unexpected error approving request:", err);
      showNotification("Unexpected error.", "error");
    }
  };

  const handleReject = async (requestId, employeeId) => {
    try {
      const result = await rejectEmployeeRequest(requestId);
      if (!result.success) {
        showNotification(result.error || "Failed to reject request.", "error");
        return;
      }
      showNotification("Request rejected.", "success");
      setRequests((prev) => prev.filter((r) => r.request_id !== requestId));
    } catch (err) {
      console.error("Unexpected error rejecting request:", err);
      showNotification("Unexpected error.", "error");
    }
  };

  const openModal = (request) => {
    setModalData(request);
  };

  const closeModal = () => {
    setModalData(null);
  };

  if (!isAuthenticated || user.role_id !== 3) {
    return (
      <div className="p-6 text-red-500 text-center">
        Access Denied: Managers Only
      </div>
    );
  }

  if (loading) {
    return <div className="p-6">Loading employee requests...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }

  return (
    <div className="max-w-full mx-auto p-6">
      {notification.message && (
        <div
          className={`mb-4 p-3 rounded ${notification.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
        >
          {notification.message}
        </div>
      )}

      <h1 className="text-2xl font-bold mb-8 pt-4">Employee Requests</h1>

      <div className="flex gap-6 mb-6  ">
        <button
          className={`font-semibold text-md ${activeTab === "time-off" ? "border-b-2 border-blue-700 text-blue-700 pb-1 cursor-pointer" : "text-gray-500 cursor-pointer hover:text-blue-700"
            }`}
          onClick={() => setActiveTab("time-off")}
        >
          Time Off Requests
        </button>
        <button
          className={`font-semibold text-md ${activeTab === "availability" ? "border-b-2 border-blue-700 text-blue-700 pb-1 cursor-pointer" : "text-gray-500 cursor-pointer hover:text-blue-700"
            }`}
          onClick={() => setActiveTab("availability")}
        >
          Availability Requests
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500 text-lg">
          No pending {activeTab} requests.
        </div>
      ) : activeTab === "availability" ? (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.request_id}
              className="bg-white rounded-lg shadow p-6 border border-gray-200"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-lg font-semibold text-gray-800">
                    {req.employee_name} (ID: {req.employee_id})
                  </p>
                  <p className="text-sm text-gray-600">
                    Original availability: {req.request.original_availability || "N/A"}
                  </p>
                  <p className="text-sm text-gray-600">
                    Requested availability: {req.request.requested_availability || "N/A"}
                  </p>
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={() => openModal(req)}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
                  >
                    Review
                  </button>
                  <button
                    onClick={() => handleApprove(req.request_id, req.employee_id)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(req.request_id, req.employee_id)}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-semibold"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-md">
            <thead className="bg-blue-50">
              <tr>
                <th className="px-4 py-3 text-blue-800 text-left border-b font-semibold">Employee Name</th>
                <th className="px-4 py-3 text-blue-800 text-left border-b font-semibold">Employee ID</th>
                <th className="px-4 py-3 text-blue-800 text-left border-b font-semibold">Reason</th>
                <th className="px-4 py-3 text-blue-800 text-left border-b font-semibold">Start Date</th>
                <th className="px-4 py-3 text-blue-800 text-left border-b font-semibold">End Date</th>
                <th className="px-4 py-3 text-blue-800 text-left border-b font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const start = req.request.start_date ? new Date(req.request.start_date) : null;
                const end = req.request.end_date ? new Date(req.request.end_date) : null;
                return (
                  <tr key={req.request_id} className="hover:bg-blue-50 transition">
                    <td className="px-4 py-3 border-b text-gray-800">{req.employee_name || "N/A"}</td>
                    <td className="px-4 py-3 border-b text-gray-800">{req.employee_id}</td>
                    <td className="px-4 py-3 border-b text-gray-700">{req.request.reason || "N/A"}</td>
                    <td className="px-4 py-3 border-b text-gray-700">{req.request.start_date || "N/A"}</td>
                    <td className="px-4 py-3 border-b text-gray-700">{req.request.end_date || "N/A"}</td>
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

      {modalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
            <button
              onClick={closeModal}
              className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700 transition"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-center">Review Availability Request</h2>
            <p className="text-gray-800 mb-2">
              <strong>Employee Name:</strong> {modalData.employee_name}
            </p>
            <p className="text-gray-800 mb-2">
              <strong>Employee ID:</strong> {modalData.employee_id}
            </p>
            <p className="text-gray-800 mb-2">
              <strong>Details:</strong>
            </p>
            <ul className="list-disc pl-6 text-gray-800">
              {modalData.request.dates && modalData.request.dates.length > 0 ? (
                modalData.request.dates.map((date, index) => (
                  <li key={index}>
                    {date.date}: {date.start_time} - {date.end_time}
                  </li>
                ))
              ) : (
                <li>No availability details provided.</li>
              )}
            </ul>
            <div className="flex justify-end mt-4">
              <button
                onClick={closeModal}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeRequests;