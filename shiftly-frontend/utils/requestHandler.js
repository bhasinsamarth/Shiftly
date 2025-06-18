// Centralized request handler for employee requests (availability, time-off, complaint)
// Uses Supabase JS client
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';

/**
 * Validate the request payload before storing.
 * @param {Object} requestData - The request data from the frontend.
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateRequest(requestData) {
  if (!requestData) return { valid: false, error: 'Missing request data.' };
  const { employee_id, request_type, request } = requestData;
  if (!employee_id || typeof employee_id !== 'number') {
    return { valid: false, error: 'Invalid or missing employee_id.' };
  }
  if (!['availability', 'complaint', 'time-off'].includes(request_type)) {
    return { valid: false, error: 'Invalid request_type.' };
  }
  if (!request || typeof request !== 'object') {
    return { valid: false, error: 'Invalid or missing request content.' };
  }
  // Additional validation for availability
  if (request_type === 'availability') {
    // Must have at least one of: preferred_hours, start_date, end_date
    if (!request.preferred_hours && (!request.start_date || !request.end_date)) {
      return { valid: false, error: 'Availability request must include preferred_hours or start_date and end_date.' };
    }
  }
  // Additional validation for time-off
  if (request_type === 'time-off') {
    // Must include reason, start_date, and end_date
    if (!request.reason || !request.start_date || !request.end_date) {
      return { valid: false, error: 'Time-off request must include reason, start_date, and end_date.' };
    }
  }
  // Additional validation for complaint
  if (request_type === 'complaint') {
    if (!request.subject || !request.details) {
      return { valid: false, error: 'Complaint must include subject and details.' };
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
  const { error } = await supabase.from('employee_request').insert([
    { employee_id, request_type, request, request_id }
  ]);
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
  // Fetch the request
  const { data, error } = await supabase
    .from('employee_request')
    .select('*')
    .eq('request_id', request_id)
    .single();
  if (error || !data) {
    return { success: false, error: 'Request not found.' };
  }

  const { employee_id, request } = data;

  try {
    // Insert into employee_availability with 0 hours for the requested days
    const startDate = new Date(request.start_date);
    const endDate = new Date(request.end_date);

    const availabilityEntries = [];
    for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
      availabilityEntries.push({
        employee_id,
        start_time: new Date(d).toISOString(),
        end_time: new Date(d).toISOString(),
      });
    }

    const { error: insertError } = await supabase
      .from('employee_availability')
      .insert(availabilityEntries);

    if (insertError) {
      throw new Error(insertError.message);
    }

    // Delete the original request
    await supabase.from('employee_request').delete().eq('request_id', request_id);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Reject an employee request (delete or mark as rejected)
 * @param {string} request_id 
 * @returns {Promise<{ success: boolean, error?: string }>} 
 */
export async function rejectEmployeeRequest(request_id) {
  const { error } = await supabase.from('employee_request').delete().eq('request_id', request_id);
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Fetch count of pending time-off requests.
 * @returns {Promise<number>} - Count of pending requests.
 */
export async function fetchPendingTimeOffCount() {
    try {
        const { count, error } = await supabase
            .from("employee_request")
            .select("request_id", { count: "exact" })
            .eq("request_type", "time-off")
            .eq("status", "Pending");

        if (error) {
            console.error("Error fetching pending time-off requests:", error);
            return 0;
        }

        return count || 0;
    } catch (err) {
        console.error("Unexpected error fetching pending time-off requests:", err);
        return 0;
    }
}

/**
 * Fetch pending availability requests.
 * @returns {Promise<Array>} - List of pending availability requests.
 */
export async function fetchPendingAvailabilityRequests() {
    try {
        const { data, error } = await supabase
            .from("employee_request")
            .select("*")
            .eq("request_type", "availability")
            .eq("status", "Pending");

        if (error) {
            console.error("Error fetching pending availability requests:", error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error("Unexpected error fetching pending availability requests:", err);
        return [];
    }
}

/**
 * Fetch pending time-off requests.
 * @returns {Promise<Array>} - List of pending time-off requests.
 */
export async function fetchPendingTimeOffRequests() {
    try {
        const { data, error } = await supabase
            .from("employee_request")
            .select("*")
            .eq("request_type", "time-off")
            .eq("status", "Pending");

        if (error) {
            console.error("Error fetching pending time-off requests:", error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error("Unexpected error fetching pending time-off requests:", err);
        return [];
    }
}
