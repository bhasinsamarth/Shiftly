import React from 'react';

export default function InputField({
  label,
  type = 'text',
  name,
  value,
  onChange,
  required = false,
  placeholder = '',
}) {
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
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
      />
    </div>
  );
}