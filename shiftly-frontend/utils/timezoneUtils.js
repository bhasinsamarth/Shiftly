/**
 * Time zone utility functions for Shiftly application
 * Handles conversion between local time and UTC for store operations
 */

import { DateTime } from 'luxon';

/**
 * List of common IANA time zones for North America
 * Used for dropdown selections
 */
export const COMMON_TIMEZONES = [
  { value: 'America/Toronto', label: 'Eastern Time (Toronto)' },
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Phoenix', label: 'Mountain Time - no DST (Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Vancouver', label: 'Pacific Time (Vancouver)' },
  { value: 'America/Edmonton', label: 'Mountain Time (Edmonton)' },
  { value: 'America/Winnipeg', label: 'Central Time (Winnipeg)' },
  { value: 'America/Halifax', label: 'Atlantic Time (Halifax)' },
  { value: 'America/St_Johns', label: 'Newfoundland Time (St. John\'s)' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
];

/**
 * Convert local time to UTC
 * @param {string} localTimeStr - Local time string (ISO format)
 * @param {string} timezone - IANA timezone name (e.g., 'America/Toronto')
 * @returns {string} - UTC time in ISO format
 */
export function localToUTC(localTimeStr, timezone) {
  if (!localTimeStr || !timezone) return null;
  
  // Handle ISO strings or date objects
  const localDateTime = typeof localTimeStr === 'string' 
    ? DateTime.fromISO(localTimeStr, { zone: timezone }) 
    : DateTime.fromJSDate(localTimeStr, { zone: timezone });
  
  return localDateTime.isValid ? localDateTime.toUTC().toISO() : null;
}

/**
 * Convert UTC time to local time
 * @param {string} utcTimeStr - UTC time string (ISO format)
 * @param {string} timezone - IANA timezone name (e.g., 'America/Toronto')
 * @param {string} format - Output format (default: 'yyyy-MM-dd HH:mm')
 * @returns {string} - Formatted local time string
 */
export function utcToLocal(utcTimeStr, timezone, format = 'yyyy-MM-dd HH:mm') {
  if (!utcTimeStr || !timezone) return '';
  
  const utcDateTime = typeof utcTimeStr === 'string' 
    ? DateTime.fromISO(utcTimeStr, { zone: 'utc' }) 
    : DateTime.fromJSDate(utcTimeStr, { zone: 'utc' });
  
  return utcDateTime.isValid 
    ? utcDateTime.setZone(timezone).toFormat(format) 
    : '';
}

/**
 * Format a date/time for display
 * @param {string|Date} dateTime - Date/time to format (ISO string or Date object)
 * @param {string} timezone - IANA timezone name
 * @param {string} format - Output format
 * @returns {string} - Formatted date/time string
 */
export function formatDateTime(dateTime, timezone, format = 'yyyy-MM-dd HH:mm') {
  if (!dateTime) return '';
  
  let dt;
  if (typeof dateTime === 'string') {
    // Assume ISO format with timezone info
    dt = DateTime.fromISO(dateTime);
    if (timezone) {
      dt = dt.setZone(timezone);
    }
  } else {
    // Handle Date objects
    dt = timezone 
      ? DateTime.fromJSDate(dateTime, { zone: timezone }) 
      : DateTime.fromJSDate(dateTime);
  }
  
  return dt.isValid ? dt.toFormat(format) : '';
}

/**
 * Get current local time in specified timezone
 * @param {string} timezone - IANA timezone name
 * @param {string} format - Output format (default: 'yyyy-MM-dd HH:mm')
 * @returns {string} - Current time in specified timezone
 */
export function getCurrentLocalTime(timezone, format = 'yyyy-MM-dd HH:mm') {
  return DateTime.now().setZone(timezone).toFormat(format);
}

/**
 * Get current time in UTC
 * @param {string} format - Output format (default: ISO)
 * @returns {string} - Current UTC time
 */
export function getCurrentUTCTime(format = null) {
  const now = DateTime.now().toUTC();
  return format ? now.toFormat(format) : now.toISO();
}

/**
 * Check if a timezone is valid
 * @param {string} timezone - IANA timezone name to check
 * @returns {boolean} - Whether timezone is valid
 */
export function isValidTimezone(timezone) {
  if (!timezone) return false;
  try {
    return DateTime.now().setZone(timezone).isValid;
  } catch (e) {
    return false;
  }
}

/**
 * Get timezone offset description (e.g., "UTC-5" or "UTC+2")
 * @param {string} timezone - IANA timezone name
 * @returns {string} - Timezone offset description
 */
export function getTimezoneOffset(timezone) {
  if (!timezone) return '';
  
  try {
    const now = DateTime.now().setZone(timezone);
    const offset = now.offset / 60; // Convert minutes to hours
    return `UTC${offset >= 0 ? '+' : ''}${offset}`;
  } catch (e) {
    return '';
  }
}
