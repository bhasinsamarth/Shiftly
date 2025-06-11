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
  const { employee_id, request_type, request } = data;

  // Routing logic
  try {
    switch (request_type) {
      case 'availability': {
        // If request has start_date and end_date, treat as time-off
        if (request.start_date && request.end_date) {
          // Insert into time_off_requests
          const { error: toError } = await supabase.from('time_off_requests').insert([
            {
              employee_id,
              reason: request.reason || '',
              start_date: request.start_date,
              end_date: request.end_date,
              timeoff_requested: true
            }
          ]);
          if (toError) throw new Error(toError.message);
        } else {
          // Insert into availability_updates
          const { error: avError } = await supabase.from('availability_updates').insert([
            {
              employee_id,
              preferred_hours: request.preferred_hours || null,
              notes: request.notes || ''
            }
          ]);
          if (avError) throw new Error(avError.message);
        }
        break;
      }
      case 'complaint': {
        const { error: cError } = await supabase.from('complaints').insert([
          {
            employee_id,
            subject: request.subject,
            details: request.details,
            status: 'open'
          }
        ]);
        if (cError) throw new Error(cError.message);
        break;
      }
      case 'time-off': {
        const { error: toError } = await supabase.from('time_off_requests').insert([
          {
            employee_id,
            reason: request.reason,
            start_date: request.start_date,
            end_date: request.end_date,
            timeoff_requested: true
          }
        ]);
        if (toError) throw new Error(toError.message);
        break;
      }
      default:
        return { success: false, error: 'Unknown request type.' };
    }
    // Optionally, mark the request as processed or delete it
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
