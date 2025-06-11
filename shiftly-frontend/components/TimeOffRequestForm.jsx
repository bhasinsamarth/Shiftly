import React, { useState, useEffect } from "react";
import { submitEmployeeRequest } from "../utils/requestHandler";
import { supabase } from "../supabaseClient";

const TimeOffRequestForm = ({ show, onClose, onSuccess }) => {
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState(null);
  const [idLoading, setIdLoading] = useState(false);
  const [idError, setIdError] = useState("");

  useEffect(() => {
    if (!show) return;
    setEmployeeId(null);
    setIdError("");
    setIdLoading(true);
    const fetchEmployeeId = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
          setIdError("Failed to get user authentication info.");
          setIdLoading(false);
          return;
        }
        const userEmail = user.email;
        const { data, error: empError } = await supabase
          .from("employee")
          .select("employee_id")
          .eq("email", userEmail)
          .single();
        if (empError || !data) {
          setIdError("Could not find your employee record. Please contact admin.");
          setIdLoading(false);
          return;
        }
        setEmployeeId(data.employee_id);
      } catch (err) {
        setIdError("Unexpected error fetching employee ID.");
      } finally {
        setIdLoading(false);
      }
    };
    fetchEmployeeId();
  }, [show]);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!reason || !startDate || !endDate) {
      setError("Please fill in all fields for your time-off request.");
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    if (startDate < today) {
      setError("The start date cannot be in the past.");
      return;
    }
    if (endDate < startDate) {
      setError("The end date cannot be before the start date.");
      return;
    }
    setLoading(true);
    const requestData = {
      employee_id: employeeId,
      request_type: "time-off",
      request: {
        reason,
        start_date: startDate,
        end_date: endDate,
      },
    };
    try {
      const result = await submitEmployeeRequest(requestData);
      if (!result.success) {
        setError(result.error || "Failed to submit time off request.");
      } else {
        setError("");
        onSuccess && onSuccess();
        onClose && onClose();
        setReason("");
        setStartDate("");
        setEndDate("");
      }
    } catch (err) {
      setError("Unexpected error occurred while submitting your request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-10 w-full max-w-lg relative animate-fadeIn">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold focus:outline-none"
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold text-center mb-6 text-blue-700">Request Time Off</h2>
        {idLoading ? (
          <div className="text-center py-8 text-blue-600 font-medium">Loading your employee info...</div>
        ) : idError ? (
          <div className="text-red-600 text-center py-8">{idError}</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="E.g. Vacation, Medical, Personal..."
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50 resize-none p-2 min-h-[80px]"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50 p-2"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50 p-2"
                />
              </div>
            </div>
            {error && <div className="text-red-600 text-sm text-center font-medium">{error}</div>}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition border border-gray-300"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition shadow-md disabled:opacity-60"
                disabled={loading || !employeeId}
              >
                {loading ? (
                  <span className="flex items-center gap-2"><svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>Submitting...</span>
                ) : (
                  "Submit Request"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default TimeOffRequestForm;
