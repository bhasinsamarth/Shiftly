/**
 * Time conversion demo component
 * Demonstrates the use of timezone utilities in the Shiftly app
 */

import React, { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import { 
  localToUTC, 
  utcToLocal, 
  formatDateTime, 
  getCurrentLocalTime,
  getCurrentUTCTime
} from '../utils/timezoneUtils';
import TimezoneDropdown from './TimezoneDropdown';

const TimeConversionDemo = ({ storeTimezone = 'America/Toronto' }) => {
  const [localTime, setLocalTime] = useState('');
  const [utcTime, setUtcTime] = useState('');
  const [selectedTimezone, setSelectedTimezone] = useState(storeTimezone);
  const [currentStoreTime, setCurrentStoreTime] = useState('');
  
  // Update current store time every minute
  useEffect(() => {
    const updateTime = () => {
      setCurrentStoreTime(getCurrentLocalTime(selectedTimezone));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [selectedTimezone]);
  
  // Convert local to UTC when local time or timezone changes
  useEffect(() => {
    if (localTime) {
      const convertedUTC = localToUTC(localTime, selectedTimezone);
      setUtcTime(convertedUTC || '');
    }
  }, [localTime, selectedTimezone]);
  
  const handleLocalTimeChange = (e) => {
    setLocalTime(e.target.value);
  };
  
  const handleTimezoneChange = (e) => {
    setSelectedTimezone(e.target.value);
  };
  
  // Convert UTC to local
  const getLocalFromUTC = () => {
    return utcTime ? utcToLocal(utcTime, selectedTimezone) : '';
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Time Zone Conversion Demo</h2>
      
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="text-sm text-blue-700 mb-2">
          <span className="font-semibold">Current Time in Store Timezone:</span>
          <div className="text-2xl font-bold">{currentStoreTime}</div>
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Store Timezone</label>
          <TimezoneDropdown
            value={selectedTimezone}
            onChange={handleTimezoneChange}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Local Time (Store's timezone)</label>
          <input
            type="datetime-local"
            value={localTime}
            onChange={handleLocalTimeChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
          />
        </div>
        
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Conversion Results:</h3>
          <div className="space-y-2">
            <div>
              <span className="font-medium">UTC Time: </span>
              <span className="font-mono">{utcTime || 'N/A'}</span>
              <p className="text-xs text-gray-500">(This is how time is stored in the database)</p>
            </div>
            
            <div>
              <span className="font-medium">Back to Local: </span>
              <span className="font-mono">{getLocalFromUTC() || 'N/A'}</span>
              <p className="text-xs text-gray-500">(This is how time is displayed to users)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeConversionDemo;
