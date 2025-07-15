import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

/**
 * Reusable dropdown component that can fetch data from different tables
 * @param {Object} props - Component props
 * @param {string} props.label - Label for the dropdown
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.name - Form field name
 * @param {string} props.value - Currently selected value
 * @param {function} props.onChange - Function to call when selection changes
 * @param {string} props.tableName - Supabase table to fetch data from
 * @param {string} props.valueField - Field to use as the option value
 * @param {string} props.displayField - Field to display in the dropdown
 * @param {boolean} props.required - Whether the field is required
 * @param {string} props.filterField - Field to filter by (optional)
 * @param {string} props.filterValue - Value to filter by (optional)
 * @param {string} props.filterOperator - Operator for filter: eq, neq, gt, lt, gte, lte, in (optional, defaults to eq)
 * @param {Array} props.options - Predefined options instead of fetching (optional)
 * @param {string} props.className - Additional CSS classes
 */
const DropdownMenu = ({
  label,
  placeholder = "Select an option",
  name,
  value,
  onChange,
  tableName,
  valueField,
  displayField,
  required = false,
  filterField,
  filterValue,
  filterOperator = 'eq',
  options: predefinedOptions,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [displayValue, setDisplayValue] = useState("");
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  
  // Fetch options from the database
  useEffect(() => {
    if (predefinedOptions) {
      setOptions(predefinedOptions);
      return;
    }
    
    if (!tableName || !valueField || !displayField) return;
    
    const fetchOptions = async () => {
      setLoading(true);
      try {
        // Just fetch the value and display fields
        let selectFields = `${valueField}, ${displayField}`;
        
        let query = supabase.from(tableName).select(selectFields);
        
        // Add filter if specified
        if (filterField && filterValue !== undefined) {
          if (filterOperator === 'neq') {
            query = query.neq(filterField, filterValue);
          } else if (filterOperator === 'gt') {
            query = query.gt(filterField, filterValue);
          } else if (filterOperator === 'lt') {
            query = query.lt(filterField, filterValue);
          } else if (filterOperator === 'gte') {
            query = query.gte(filterField, filterValue);
          } else if (filterOperator === 'lte') {
            query = query.lte(filterField, filterValue);
          } else if (filterOperator === 'in') {
            query = query.in(filterField, filterValue);
          } else {
            // Default to equality
            query = query.eq(filterField, filterValue);
          }
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        setOptions(data || []);
      } catch (err) {
        console.error(`Error fetching options from ${tableName}:`, err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOptions();
  }, [tableName, valueField, displayField, filterField, filterValue, filterOperator, predefinedOptions]);
  
  // Update display value when value or options change
  useEffect(() => {
    if (!value || !options.length) {
      setDisplayValue(placeholder);
      return;
    }
    
    const selectedOption = options.find(option => option[valueField]?.toString() === value?.toString());
    if (!selectedOption) {
      setDisplayValue(placeholder);
      return;
    }

    // Use displayField or fallback to placeholder
    setDisplayValue(selectedOption[displayField] || placeholder);
  }, [value, options, valueField, displayField, placeholder, tableName]);
  
  // Handle click outside to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Ensure menu width matches button width
  useEffect(() => {
    if (isOpen && buttonRef.current && menuRef.current) {
      const buttonWidth = buttonRef.current.offsetWidth;
      menuRef.current.style.width = `${buttonWidth}px`;
    }
  }, [isOpen]);
  
  const handleSelect = (option) => {
    if (onChange) {
      onChange({
        target: {
          name,
          value: option[valueField]
        }
      });
    }
    setIsOpen(false);
  };
  
  return (
    <div className="w-full" ref={dropdownRef}>
      {label && (
        <label className="block text-gray-700 font-medium mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          className={`inline-flex w-full justify-between items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none ${className}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={`truncate ${value ? 'text-gray-900' : 'text-gray-500'}`}>
            {loading ? 'Loading...' : displayValue}
          </span>
          <ChevronDownIcon className="-mr-1 h-5 w-5 text-gray-400" aria-hidden="true" />
        </button>
        
        {isOpen && (
          <div 
            ref={menuRef}
            className="absolute z-10 mt-1 max-h-60 overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
            role="listbox"
          >
            {loading ? (
              <div className="px-4 py-2 text-sm text-gray-500">Loading...</div>
            ) : options.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-500">No options available</div>
            ) : (
              options.map((option) => {
                // Display the field value or fall back to No Name
                const displayText = option[displayField] || '(No Name)';
                  
                return (
                  <div
                    key={option[valueField]}
                    className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 ${option[valueField]?.toString() === value?.toString() ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}
                    onClick={() => handleSelect(option)}
                    role="option"
                    aria-selected={option[valueField]?.toString() === value?.toString()}
                  >
                    {displayText}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DropdownMenu;
