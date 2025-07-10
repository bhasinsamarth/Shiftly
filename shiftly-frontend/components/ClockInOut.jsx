import React, { useState, useEffect } from 'react';
import { useLocation } from '../context/LocationContext';
import { isWithinRadius, formatDistance, calculateDistance } from '../utils/locationService';
import { supabase } from '../supabaseClient';

const ClockInOut = ({ 
    storeLocation, 
    userId, // This will be employee_id
    employeeName, 
    onClockEvent,
    allowedRadius = 50,
    className = "" 
}) => {
    const { 
        currentLocation, 
        locationError, 
        isLoadingLocation, 
        requestLocation, 
        hasLocation 
    } = useLocation();
    
    const [isClockedIn, setIsClockedIn] = useState(false);
    const [isOnBreak, setIsOnBreak] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [clockEvents, setClockEvents] = useState([]);
    const [distance, setDistance] = useState(null);
    const [withinRadius, setWithinRadius] = useState(false);

    // Check if user is currently clocked in
    useEffect(() => {
        checkClockStatus();
    }, [userId]);

    // Update distance and radius check when location changes
    useEffect(() => {
        if (currentLocation && storeLocation) {
            const dist = calculateDistance(
                currentLocation.latitude,
                currentLocation.longitude,
                storeLocation.latitude,
                storeLocation.longitude
            );
            setDistance(dist);
            setWithinRadius(isWithinRadius(currentLocation, storeLocation, allowedRadius));
        }
    }, [currentLocation, storeLocation, allowedRadius]);

    const checkClockStatus = async () => {
        try {
            // Get today's schedule entry for this employee
            const today = new Date().toISOString().split('T')[0];
            
            const { data, error } = await supabase
                .from('store_schedule')
                .select('schedule_id, time_log')
                .eq('employee_id', userId)
                .gte('start_time', `${today}T00:00:00`)
                .lte('start_time', `${today}T23:59:59`)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw error;
            }
            
            if (data && data.time_log) {
                const timeLogs = Array.isArray(data.time_log) ? data.time_log : [];
                // Check if there's an active clock in (no corresponding clock out)
                const hasActiveClock = timeLogs.some(log => 
                    log.type === 'clock_in' && 
                    !timeLogs.find(outLog => 
                        outLog.type === 'clock_out' && 
                        new Date(outLog.timestamp) > new Date(log.timestamp)
                    )
                );
                // Check if there's an active break (break_start without break_end)
                const hasActiveBreak = timeLogs.some(log => 
                    log.type === 'break_start' && 
                    !timeLogs.find(endLog => 
                        endLog.type === 'break_end' && 
                        new Date(endLog.timestamp) > new Date(log.timestamp)
                    )
                );
                setIsClockedIn(hasActiveClock);
                setIsOnBreak(hasActiveBreak);
                setClockEvents(timeLogs);
            } else {
                setIsClockedIn(false);
                setIsOnBreak(false);
                setClockEvents([]);
            }
        } catch (error) {
            console.error('Error checking clock status:', error);
            setIsClockedIn(false);
            setIsOnBreak(false);
            setClockEvents([]);
        }
    };

    const handleClockIn = async () => {
        if (!withinRadius) {
            alert(`You must be within ${allowedRadius}m of the store to clock in. Current distance: ${formatDistance(distance)}`);
            return;
        }

        setIsProcessing(true);
        try {
            const now = new Date().toISOString();
            const today = new Date().toISOString().split('T')[0];
            
            // Get today's schedule entry
            const { data: scheduleData, error: fetchError } = await supabase
                .from('store_schedule')
                .select('schedule_id, time_log')
                .eq('employee_id', userId)
                .gte('start_time', `${today}T00:00:00`)
                .lte('start_time', `${today}T23:59:59`)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            if (!scheduleData) {
                alert('No schedule found for today. Please contact your manager.');
                return;
            }

            // Create new clock in event
            const newClockEvent = {
                type: 'clock_in',
                timestamp: now,
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                distance_from_store: Math.round(distance)
            };

            // Get existing time logs and add new event
            const existingLogs = scheduleData.time_log || [];
            const updatedLogs = [...existingLogs, newClockEvent];

            // Update the schedule with new time log
            const { data, error } = await supabase
                .from('store_schedule')
                .update({ time_log: updatedLogs })
                .eq('schedule_id', scheduleData.schedule_id)
                .select();

            if (error) throw error;

            setIsClockedIn(true);
            setClockEvents(updatedLogs);
            if (onClockEvent) {
                onClockEvent('clock_in', newClockEvent);
            }
        } catch (error) {
            console.error('Error clocking in:', error);
            alert('Failed to clock in. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClockOut = async () => {
        if (!withinRadius) {
            alert(`You must be within ${allowedRadius}m of the store to clock out. Current distance: ${formatDistance(distance)}`);
            return;
        }

        setIsProcessing(true);
        try {
            const now = new Date().toISOString();
            const today = new Date().toISOString().split('T')[0];
            
            // Get today's schedule entry
            const { data: scheduleData, error: fetchError } = await supabase
                .from('store_schedule')
                .select('schedule_id, time_log')
                .eq('employee_id', userId)
                .gte('start_time', `${today}T00:00:00`)
                .lte('start_time', `${today}T23:59:59`)
                .single();

            if (fetchError) {
                throw fetchError;
            }

            if (!scheduleData || !scheduleData.time_log) {
                alert('No active clock in session found.');
                return;
            }

            const existingLogs = scheduleData.time_log || [];
            
            // Check if there's an active clock in
            const hasActiveClock = existingLogs.some(log => 
                log.type === 'clock_in' && 
                !existingLogs.find(outLog => 
                    outLog.type === 'clock_out' && 
                    new Date(outLog.timestamp) > new Date(log.timestamp)
                )
            );

            if (!hasActiveClock) {
                alert('No active clock in session found.');
                return;
            }

            // Create new clock out event
            const newClockEvent = {
                type: 'clock_out',
                timestamp: now,
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                distance_from_store: Math.round(distance)
            };

            // Add clock out event to logs
            const updatedLogs = [...existingLogs, newClockEvent];

            // Update the schedule with new time log
            const { data, error } = await supabase
                .from('store_schedule')
                .update({ time_log: updatedLogs })
                .eq('schedule_id', scheduleData.schedule_id)
                .select();

            if (error) throw error;

            setIsClockedIn(false);
            setClockEvents(updatedLogs);
            if (onClockEvent) {
                onClockEvent('clock_out', newClockEvent);
            }
        } catch (error) {
            console.error('Error clocking out:', error);
            alert('Failed to clock out. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleStartBreak = async () => {
        if (!withinRadius) {
            alert(`You must be within ${allowedRadius}m of the store to start a break. Current distance: ${formatDistance(distance)}`);
            return;
        }

        if (!isClockedIn) {
            alert('You must be clocked in to start a break.');
            return;
        }

        setIsProcessing(true);
        try {
            const now = new Date().toISOString();
            const today = new Date().toISOString().split('T')[0];
            
            // Get today's schedule entry
            const { data: scheduleData, error: fetchError } = await supabase
                .from('store_schedule')
                .select('schedule_id, time_log')
                .eq('employee_id', userId)
                .gte('start_time', `${today}T00:00:00`)
                .lte('start_time', `${today}T23:59:59`)
                .single();

            if (fetchError) {
                throw fetchError;
            }

            // Create new break start event
            const newBreakEvent = {
                type: 'break_start',
                timestamp: now,
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                distance_from_store: Math.round(distance)
            };

            // Get existing time logs and add new event
            const existingLogs = scheduleData.time_log || [];
            const updatedLogs = [...existingLogs, newBreakEvent];

            // Update the schedule with new time log
            const { data, error } = await supabase
                .from('store_schedule')
                .update({ time_log: updatedLogs })
                .eq('schedule_id', scheduleData.schedule_id)
                .select();

            if (error) throw error;

            setIsOnBreak(true);
            setClockEvents(updatedLogs);
            if (onClockEvent) {
                onClockEvent('break_start', newBreakEvent);
            }
        } catch (error) {
            console.error('Error starting break:', error);
            alert('Failed to start break. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEndBreak = async () => {
        if (!withinRadius) {
            alert(`You must be within ${allowedRadius}m of the store to end a break. Current distance: ${formatDistance(distance)}`);
            return;
        }

        if (!isOnBreak) {
            alert('You are not currently on a break.');
            return;
        }

        setIsProcessing(true);
        try {
            const now = new Date().toISOString();
            const today = new Date().toISOString().split('T')[0];
            
            // Get today's schedule entry
            const { data: scheduleData, error: fetchError } = await supabase
                .from('store_schedule')
                .select('schedule_id, time_log')
                .eq('employee_id', userId)
                .gte('start_time', `${today}T00:00:00`)
                .lte('start_time', `${today}T23:59:59`)
                .single();

            if (fetchError) {
                throw fetchError;
            }

            // Create new break end event
            const newBreakEvent = {
                type: 'break_end',
                timestamp: now,
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                distance_from_store: Math.round(distance)
            };

            // Get existing time logs and add new event
            const existingLogs = scheduleData.time_log || [];
            const updatedLogs = [...existingLogs, newBreakEvent];

            // Update the schedule with new time log
            const { data, error } = await supabase
                .from('store_schedule')
                .update({ time_log: updatedLogs })
                .eq('schedule_id', scheduleData.schedule_id)
                .select();

            if (error) throw error;

            setIsOnBreak(false);
            setClockEvents(updatedLogs);
            if (onClockEvent) {
                onClockEvent('break_end', newBreakEvent);
            }
        } catch (error) {
            console.error('Error ending break:', error);
            alert('Failed to end break. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const getLocationStatus = () => {
        if (isLoadingLocation) return { text: 'Getting location...', color: 'text-blue-500' };
        if (locationError) return { text: `Location error: ${locationError}`, color: 'text-red-500' };
        if (!hasLocation) return { text: 'Location required', color: 'text-yellow-500' };
        if (distance === null) return { text: 'Calculating distance...', color: 'text-blue-500' };
        
        return {
            text: `Distance: ${formatDistance(distance)}`,
            color: withinRadius ? 'text-green-500' : 'text-red-500'
        };
    };

    const locationStatus = getLocationStatus();
    const canClockInOut = hasLocation && withinRadius && !isProcessing;

    return (
        <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
            <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    {employeeName ? `${employeeName} - ` : ''}Clock In/Out
                </h3>
                
                {/* Location Status */}
                <div className="mb-4">
                    <p className={`text-sm ${locationStatus.color}`}>
                        {locationStatus.text}
                    </p>
                    {!hasLocation && (
                        <button
                            onClick={requestLocation}
                            disabled={isLoadingLocation}
                            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                        >
                            {isLoadingLocation ? 'Getting Location...' : 'Enable Location'}
                        </button>
                    )}
                </div>

                {/* Clock In/Out Buttons */}
                {hasLocation && (
                    <div className="space-y-3">
                        <div className={`p-3 rounded-lg ${withinRadius ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <p className="text-sm">
                                {withinRadius 
                                    ? '✅ Within store radius' 
                                    : `❌ Too far from store (${allowedRadius}m required)`
                                }
                            </p>
                        </div>

                        <div className="space-y-2">
                            <button
                                onClick={handleClockIn}
                                disabled={!canClockInOut || isClockedIn}
                                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                                    canClockInOut && !isClockedIn
                                        ? 'bg-green-500 hover:bg-green-600 text-white'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                {isProcessing ? 'Processing...' : 'Clock In'}
                            </button>

                            <button
                                onClick={handleClockOut}
                                disabled={!canClockInOut || !isClockedIn}
                                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                                    canClockInOut && isClockedIn
                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                {isProcessing ? 'Processing...' : 'Clock Out'}
                            </button>

                            {/* Break Buttons - Only show when clocked in */}
                            {isClockedIn && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Break Controls</h4>
                                    <div className="space-y-2">
                                        <button
                                            onClick={handleStartBreak}
                                            disabled={!canClockInOut || isOnBreak}
                                            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors text-sm ${
                                                canClockInOut && !isOnBreak
                                                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            }`}
                                        >
                                            {isProcessing ? 'Processing...' : 'Start Break'}
                                        </button>

                                        <button
                                            onClick={handleEndBreak}
                                            disabled={!canClockInOut || !isOnBreak}
                                            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors text-sm ${
                                                canClockInOut && isOnBreak
                                                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            }`}
                                        >
                                            {isProcessing ? 'Processing...' : 'End Break'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Status Indicator */}
                        <div className={`p-3 rounded text-sm font-medium ${
                            isClockedIn 
                                ? isOnBreak
                                    ? 'bg-yellow-100 text-yellow-800' 
                                    : 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                        }`}>
                            Status: {
                                isClockedIn 
                                    ? isOnBreak 
                                        ? 'On Break' 
                                        : 'Clocked In'
                                    : 'Clocked Out'
                            }
                        </div>

                        {/* Recent Activity Log */}
                        {clockEvents.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Today's Activity</h4>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                    {clockEvents.slice(-5).reverse().map((event, index) => (
                                        <div key={index} className="text-xs bg-gray-50 p-2 rounded flex justify-between">
                                            <span className="capitalize">{event.type.replace('_', ' ')}</span>
                                            <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClockInOut;
