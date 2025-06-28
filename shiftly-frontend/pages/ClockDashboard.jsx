import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import ClockInOut from '../components/ClockInOut';
import { calculateHoursFromTimeLogs, formatDuration } from '../utils/locationService';

const ClockDashboard = () => {
    const { user } = useAuth();
    const [userProfile, setUserProfile] = useState(null);
    const [storeLocation, setStoreLocation] = useState(null);
    const [recentClockEvents, setRecentClockEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchUserData();
        }
    }, [user]);

    useEffect(() => {
        if (userProfile) {
            fetchRecentClockEvents();
        }
    }, [userProfile]);

    const fetchUserData = async () => {
        try {
            setIsLoading(true);
            
            // Get user profile and store information
            const { data: profile, error: profileError } = await supabase
                .from('employee')
                .select(`
                    *,
                    store:store_id (
                        store_id,
                        store_name,
                        address_line_1,
                        address_line_2,
                        city,
                        province,
                        postal_code,
                        country,
                        coordinates
                    )
                `)
                .eq('email', user.email)
                .single();

            if (profileError) throw profileError;

            setUserProfile(profile);
            
            if (profile.store && profile.store.coordinates) {
                // Handle coordinates - check if it's already parsed or needs parsing
                let coords;
                if (typeof profile.store.coordinates === 'object') {
                    coords = profile.store.coordinates;
                } else {
                    coords = JSON.parse(profile.store.coordinates);
                }
                
                setStoreLocation({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    name: profile.store.store_name,
                    address: `${profile.store.address_line_1}${profile.store.address_line_2 ? ', ' + profile.store.address_line_2 : ''}, ${profile.store.city}, ${profile.store.province}`
                });
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchRecentClockEvents = async () => {
        try {
            if (!userProfile?.employee_id) return;

            // Get recent schedule entries with time_log data
            const { data, error } = await supabase
                .from('store_schedule')
                .select('schedule_id, start_time, time_log')
                .eq('employee_id', userProfile.employee_id)
                .not('time_log', 'is', null)
                .order('start_time', { ascending: false })
                .limit(10);

            if (error) throw error;
            
            // Transform time_log data into clock events format
            const clockEvents = [];
            
            data?.forEach(schedule => {
                if (schedule.time_log && Array.isArray(schedule.time_log)) {
                    const logs = schedule.time_log.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    
                    let clockIn = null;
                    let clockOut = null;
                    let breaks = [];
                    
                    logs.forEach(log => {
                        switch (log.type) {
                            case 'clock_in':
                                clockIn = log;
                                break;
                            case 'clock_out':
                                clockOut = log;
                                break;
                            case 'break_start':
                            case 'break_end':
                                breaks.push(log);
                                break;
                        }
                    });
                    
                    if (clockIn) {
                        clockEvents.push({
                            id: schedule.schedule_id,
                            date: schedule.start_time,
                            clock_in_time: clockIn.timestamp,
                            clock_out_time: clockOut?.timestamp || null,
                            distance_from_store: clockIn.distance_from_store,
                            breaks: breaks,
                            time_log: schedule.time_log
                        });
                    }
                }
            });

            setRecentClockEvents(clockEvents);
        } catch (error) {
            console.error('Error fetching clock events:', error);
        }
    };

    const handleClockEvent = (eventType, eventData) => {
        // Refresh recent events when a clock event occurs
        fetchRecentClockEvents();
        
        // You could also show a toast notification here
        console.log(`${eventType} successful:`, eventData);
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };

    const calculateHoursWorked = (clockIn, clockOut, timeLogs = null) => {
        if (!clockIn || !clockOut) return 'In Progress';
        
        // If we have time logs, use the proper calculation that includes breaks
        if (timeLogs && Array.isArray(timeLogs)) {
            const { workTime } = calculateHoursFromTimeLogs(timeLogs);
            return formatDuration(workTime);
        }
        
        // Fallback to simple calculation
        const start = new Date(clockIn);
        const end = new Date(clockOut);
        const diffMs = end - start;
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${hours}h ${minutes}m`;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading clock dashboard...</p>
                </div>
            </div>
        );
    }

    if (!userProfile || !storeLocation) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Setup Required</h2>
                    <p className="text-gray-600">Your profile or store information is not complete.</p>
                    <p className="text-gray-600">Please contact your manager.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Clock Dashboard</h1>
                    <p className="text-gray-600 mt-2">
                        Welcome, {userProfile.first_name} {userProfile.last_name}
                    </p>
                    <p className="text-sm text-gray-500">
                        Store: {storeLocation.name} - {storeLocation.address}
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Clock In/Out Component */}
                    <div className="lg:col-span-1">
                        <ClockInOut
                            storeLocation={storeLocation}
                            userId={userProfile.employee_id}
                            employeeName={`${userProfile.first_name} ${userProfile.last_name}`}
                            onClockEvent={handleClockEvent}
                            allowedRadius={50}
                        />
                    </div>

                    {/* Recent Clock Events */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Clock Events</h2>
                            
                            {recentClockEvents.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No clock events found.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full table-auto">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Clock In</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Clock Out</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Hours</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Distance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {recentClockEvents.map((event) => (
                                                <tr key={event.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-900">
                                                        {formatDateTime(event.clock_in_time)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900">
                                                        {formatDateTime(event.clock_out_time)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900">
                                                        {calculateHoursWorked(event.clock_in_time, event.clock_out_time, event.time_log)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900">
                                                        {event.distance_from_store ? `${event.distance_from_store}m` : 'N/A'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-lg shadow-md p-6 text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">This Week</h3>
                        <p className="text-3xl font-bold text-blue-600">0h</p>
                        <p className="text-sm text-gray-500">Hours worked</p>
                    </div>
                    
                    <div className="bg-white rounded-lg shadow-md p-6 text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">This Month</h3>
                        <p className="text-3xl font-bold text-green-600">0h</p>
                        <p className="text-sm text-gray-500">Hours worked</p>
                    </div>
                    
                    <div className="bg-white rounded-lg shadow-md p-6 text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Total</h3>
                        <p className="text-3xl font-bold text-purple-600">{recentClockEvents.length}</p>
                        <p className="text-sm text-gray-500">Clock events</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClockDashboard;
