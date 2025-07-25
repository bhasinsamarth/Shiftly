// Centralized request handler for employee requests (availability, time-off, complaint)
import { supabase } from "../supabaseClient";
import { v4 as uuidv4 } from "uuid";

/**
 * Validate the request payload before storing.
 * @param {Object} requestData - The request data from the frontend.
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateRequest(requestData) {
  if (!requestData) return { valid: false, error: "Missing request data." };
  const { employee_id, request_type, request } = requestData;
  if (!employee_id || typeof employee_id !== "number") {
    return { valid: false, error: "Invalid or missing employee_id." };
  }
  if (!["availability", "complaint", "time-off"].includes(request_type)) {
    return { valid: false, error: "Invalid request_type." };
  }
  if (!request || typeof request !== "object") {
    return { valid: false, error: "Invalid or missing request content." };
  }

  if (request_type === "availability") {
    if (
      !request.preferred_hours &&
      (!request.start_date || !request.end_date)
    ) {
      return {
        valid: false,
        error:
          "Availability request must include preferred_hours or start_date and end_date.",
      };
    }
  }

  if (request_type === "time-off") {
    if (!request.reason || !request.start_date || !request.end_date) {
      return {
        valid: false,
        error:
          "Time-off request must include reason, start_date, and end_date.",
      };
    }
  }

  if (request_type === "complaint") {
    if (!request.subject || !request.details) {
      return {
        valid: false,
        error: "Complaint must include subject and details.",
      };
    }
  }

  return { valid: true, error: null };
}

/**
 * Store a new employee request in the employee_request table.
 * @param {Object} requestData - { employee_id, request_type, request }
 * @returns {Promise<{ success: boolean, error?: string, request_id?: string }>}
 */
export async function submitEmployeeRequest(requestData) {
  const validation = validateRequest(requestData);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const request_id = uuidv4();
  const { employee_id, request_type, request } = requestData;

  const { error } = await supabase
    .from("employee_request")
    .insert([{ employee_id, request_type, request, request_id }]);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, request_id };
}

/**
 * Approve and route an employee request to the correct table.
 * @param {string} request_id - UUID of the request to approve.
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function approveEmployeeRequest(request_id) {
  const { data, error } = await supabase
    .from("employee_request")
    .select("*")
    .eq("request_id", request_id)
    .single();

  if (error || !data) {
    return { success: false, error: "Request not found." };
  }

  const { employee_id, request } = data;

  try {
    const entries = [];

    if (request.preferred_hours) {
      for (const [day, { start_time, end_time }] of Object.entries(
        request.preferred_hours
      )) {
        const startDateObj = new Date(start_time);
        const endDateObj = new Date(end_time);

        if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
          entries.push({
            employee_id,
            start_time: startDateObj.toISOString(),
            end_time: endDateObj.toISOString(),
          });
        }
      }
    } else {
      const startDate = new Date(request.start_date);
      const endDate = new Date(request.end_date);

      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const iso = new Date(d).toISOString();
        entries.push({
          employee_id,
          start_time: iso,
          end_time: iso,
        });
      }
    }

    const { error: insertError } = await supabase
      .from("employee_availability")
      .insert(entries);

    if (insertError) {
      throw new Error(insertError.message);
    }

    const { error: updateError } = await supabase
      .from("employee_request")
      .update({ status: "Approved" })
      .eq("request_id", request_id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Reject an employee request (mark as rejected).
 * @param {string} request_id
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function rejectEmployeeRequest(request_id) {
  const { error } = await supabase
    .from("employee_request")
    .update({ status: "Declined" })
    .eq("request_id", request_id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Fetch count of pending time-off requests.
 * @returns {Promise<number>}
 */
export async function fetchPendingTimeOffCount() {
  const { count, error } = await supabase
    .from("employee_request")
    .select("request_id", { count: "exact" })
    .eq("request_type", "time-off")
    .eq("status", "Pending");

  return error ? 0 : count || 0;
}

/**
 * Fetch pending availability requests.
 * @returns {Promise<Array>}
 */
export async function fetchPendingAvailabilityRequests() {
  const { data, error } = await supabase
    .from("employee_request")
    .select("*")
    .eq("request_type", "availability")
    .eq("status", "Pending");

  return error ? [] : data || [];
}

/**
 * Fetch pending time-off requests.
 * @returns {Promise<Array>}
 */
export async function fetchPendingTimeOffRequests() {
  const { data, error } = await supabase
    .from("employee_request")
    .select("*")
    .eq("request_type", "time-off")
    .eq("status", "Pending");

  return error ? [] : data || [];
}
