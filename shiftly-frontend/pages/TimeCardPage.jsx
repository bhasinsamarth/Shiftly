// Example implementation for TimeCardPage to properly handle time zones
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { utcToLocal, localToUTC, getCurrentLocalTime } from '../utils/timezoneUtils';
import TimezoneDropdown from '../components/TimezoneDropdown';

const TimeCardPage = () => {
  const { user } = useAuth();
  const [timeCards, setTimeCards] = useState([]);
  const [storeTimezone, setStoreTimezone] = useState('America/Toronto');
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState(null);
  const [stores, setStores] = useState([]);
  
  useEffect(() => {
    fetchStores();
  }, []);
  
  // Fetch stores to get their time zones
  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('store')
        .select('store_id, store_name, timezone')
        .order('store_name');
        
      if (error) throw error;
      
      setStores(data || []);
      if (data && data.length > 0) {
        setSelectedStore(data[0]);
        setStoreTimezone(data[0].timezone || 'America/Toronto');
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
    }
  };
  
  // When store selection changes, update timezone
  useEffect(() => {
    if (selectedStore && selectedStore.timezone) {
      setStoreTimezone(selectedStore.timezone);
    }
  }, [selectedStore]);
  
  // Fetch time cards when store selection changes
  useEffect(() => {
    if (selectedStore) {
      fetchTimeCards(selectedStore.store_id);
    }
  }, [selectedStore]);
  
  const fetchTimeCards = async (storeId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('time_card')
        .select(`
          time_card_id,
          employee_id,
          store_id,
          clock_in,
          clock_out,
          approved,
          notes,
          employee:employee_id(first_name, last_name)
        `)
        .eq('store_id', storeId);
        
      if (error) throw error;
      setTimeCards(data || []);
    } catch (err) {
      console.error('Error fetching time cards:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Create a new time card - IMPORTANT: Convert local time to UTC before saving
  const createTimeCard = async (employeeId, clockInLocal, clockOutLocal) => {
    try {
      // Convert local times to UTC for storage
      const clockInUTC = localToUTC(clockInLocal, storeTimezone);
      const clockOutUTC = localToUTC(clockOutLocal, storeTimezone);
      
      const { data, error } = await supabase
        .from('time_card')
        .insert([
          {
            employee_id: employeeId,
            store_id: selectedStore.store_id,
            clock_in: clockInUTC,  // UTC time
            clock_out: clockOutUTC, // UTC time
            approved: false
          }
        ]);
        
      if (error) throw error;
      
      // Refresh time cards
      fetchTimeCards(selectedStore.store_id);
    } catch (err) {
      console.error('Error creating time card:', err);
    }
  };
  
  // Format time for display - IMPORTANT: Convert UTC to local store time for display
  const formatTimeCard = (timeCard) => {
    if (!timeCard || !timeCard.clock_in) return null;
    
    // Convert UTC timestamps to local store time
    const clockInLocal = utcToLocal(timeCard.clock_in, storeTimezone, 'yyyy-MM-dd hh:mm a');
    const clockOutLocal = timeCard.clock_out 
      ? utcToLocal(timeCard.clock_out, storeTimezone, 'yyyy-MM-dd hh:mm a')
      : 'Still clocked in';
      
    return {
      ...timeCard,
      clockInLocal,
      clockOutLocal
    };
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Time Cards</h1>
      
      {/* Store selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Select Store</label>
        <select
          value={selectedStore?.store_id || ''}
          onChange={(e) => {
            const store = stores.find(s => s.store_id === parseInt(e.target.value));
            setSelectedStore(store);
          }}
          className="w-full p-2 border border-gray-300 rounded"
        >
          {stores.map(store => (
            <option key={store.store_id} value={store.store_id}>
              {store.store_name} {store.timezone && `(${store.timezone})`}
            </option>
          ))}
        </select>
      </div>
      
      {/* Current store time display */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700">
          Current Time at {selectedStore?.store_name}: 
          <span className="font-bold ml-2">
            {getCurrentLocalTime(storeTimezone, 'yyyy-MM-dd hh:mm:ss a')}
          </span>
        </p>
      </div>
      
      {/* Time card list */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Time Card Records</h2>
        
        {loading ? (
          <div className="text-center py-4">Loading time cards...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-4 border-b text-left">Employee</th>
                  <th className="py-2 px-4 border-b text-left">Clock In</th>
                  <th className="py-2 px-4 border-b text-left">Clock Out</th>
                  <th className="py-2 px-4 border-b text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {timeCards.map(card => {
                  const formattedCard = formatTimeCard(card);
                  return (
                    <tr key={card.time_card_id}>
                      <td className="py-2 px-4">
                        {card.employee?.first_name} {card.employee?.last_name}
                      </td>
                      <td className="py-2 px-4">{formattedCard?.clockInLocal}</td>
                      <td className="py-2 px-4">{formattedCard?.clockOutLocal}</td>
                      <td className="py-2 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          card.approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {card.approved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {timeCards.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-4 text-center text-gray-500">
                      No time cards found for this store.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeCardPage;
