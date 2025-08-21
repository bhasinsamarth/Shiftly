import React, { useState } from 'react';

/**
 * InputField component with built-in and custom validation support.
 *
 * Props:
 * - label: string (label for the input)
 * - type: string (input type, e.g. 'text', 'email', 'number', etc.)
 * - name: string (input name/id)
 * - value: string (input value)
 * - onChange: function (called with event if value changes and is valid)
 * - required: boolean (if true, input is required)
 * - placeholder: string (placeholder text)
 * - validate: function (optional, custom validation, returns error string or null)
 */
export default function InputField({
  label,
  type = 'text',
  name,
  value,
  onChange,
  required = false,
  placeholder = '',
  validate, // optional custom validation function
}) {
  const [error, setError] = useState('');

  // Built-in validation for common types
  function validateValue(val) {
    if (required && !val) {
      return 'This field is required.';
    }
    if (type === 'email') {
      // Simple email regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (val && !emailRegex.test(val)) {
        return 'Please enter a valid email address.';
      }
    }
    if (type === 'number') {
      // Allow empty string, only show error if not empty and not a valid number
      if (val !== '' && isNaN(val)) {
        return 'Please enter a valid number.';
      }
    }
    if (type === 'password') {
      // Example: minimum 8 characters
      if (val && val.length < 8) {
        return 'Password must be at least 8 characters.';
      }
    }
    // Custom validation function
    if (validate) {
      const customError = validate(val);
      if (customError) return customError;
    }
    return '';
  }

  // Handle input change and validate
  function sanitizeBrackets(str) {
    // Remove < and > to prevent script injection
    return str.replace(/[<>]/g, '');
  }

  function handleInputChange(e) {
    let val = e.target.value;
    val = sanitizeBrackets(val);
    const validationError = validateValue(val);
    setError(validationError);
    // Support both value and event-based onChange
    if (typeof onChange === 'function') {
      // If parent expects event, call with synthetic event
      if (onChange.length > 0) {
        // Create a synthetic event with sanitized value
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: val,
            name: name
          }
        };
        onChange(syntheticEvent);
      } else {
        // If parent expects just value
        onChange(val);
      }
    }
  }

  return (
    <div className="mb-3 sm:mb-4">
      <label htmlFor={name} className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={handleInputChange}
        required={required}
        placeholder={placeholder}
        className={`w-full px-3 sm:px-4 py-2.5 sm:py-2 text-sm border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent ${error ? 'border-red-400' : 'border-gray-300'}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && (
        <div id={`${name}-error`} className="text-xs text-red-500 mt-1">
          {error}
        </div>
      )}
    </div>
  );
}