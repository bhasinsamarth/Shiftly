import React from 'react';
import { COMMON_TIMEZONES, getTimezoneOffset } from '../utils/timezoneUtils';

/**
 * Reusable timezone dropdown component
 * Displays a dropdown with common North American timezones
 * 
 * @param {string} value - Selected timezone value
 * @param {function} onChange - Change handler function
 * @param {string} className - Additional CSS classes
 * @param {boolean} showOffset - Whether to show UTC offset in dropdown
 * @param {boolean} required - Whether field is required
 * @param {string} placeholder - Placeholder text
 */
const TimezoneDropdown = ({ 
  value, 
  onChange, 
  className = '', 
  showOffset = true,
  required = false,
  placeholder = '-- Select Timezone --'
}) => {
  return (
    <select
      value={value || ''}
      onChange={onChange}
      className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${className}`}
      required={required}
    >
      <option value="">{placeholder}</option>
      
      {COMMON_TIMEZONES.map(tz => (
        <option key={tz.value} value={tz.value}>
          {tz.label} {showOffset && getTimezoneOffset(tz.value) ? `(${getTimezoneOffset(tz.value)})` : ''}
        </option>
      ))}
    </select>
  );
};

export default TimezoneDropdown;
