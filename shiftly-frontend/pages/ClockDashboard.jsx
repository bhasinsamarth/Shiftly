import React, { useState, useEffect, useRef } from 'react';
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

    // Add state for date filters
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - d.getDay()); // Start of week
        return d.toISOString().split('T')[0];
    });
    const [tillDate, setTillDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - d.getDay() + 6); // End of week
        return d.toISOString().split('T')[0];
    });
    // Always show timecard for current week by default
    const [showTimecard, setShowTimecard] = useState(true);
    const [filterKey, setFilterKey] = useState(0); // To force re-render WeeklyActivityTable

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
        <div className="min-h-screen py-8 text-base">
            <div className="max-w-full mx-auto px-4">
                {/* Header */}
                <div className="mb-8 text-left">
                    <h1 className="text-2xl font-bold text-gray-900">Clock Dashboard</h1>
                    <p className="text-gray-700 mt-2">
                        Welcome, {userProfile.first_name} {userProfile.last_name}
                    </p>
                    <p className="text-sm text-gray-500">
                        Store: {storeLocation.name} - {storeLocation.address}
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Clock In/Out Component */}
                    <div className="lg:col-span-1">
                            <ClockInOut
                                storeLocation={storeLocation}
                                userId={userProfile.employee_id}
                                employeeName={`${userProfile.first_name} ${userProfile.last_name}`}
                                onClockEvent={handleClockEvent}
                                allowedRadius={6000}
                            />
                        </div>

                    {/*  Activity */}
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-2xl shadow-lg p-10 min-h-[500px] flex flex-col">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">Activity</h2>
                            {/* Filter Controls */}
                            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                                <div className="flex items-center gap-2">
                                    <label htmlFor="from-date" className="font-medium text-gray-700">From</label>
                                    <input
                                        id="from-date"
                                        type="date"
                                        className="border rounded px-2 py-1 text-base"
                                        value={fromDate}
                                        max={tillDate}
                                        onChange={e => setFromDate(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label htmlFor="till-date" className="font-medium text-gray-700">Till</label>
                                    <input
                                        id="till-date"
                                        type="date"
                                        className="border rounded px-2 py-1 text-base"
                                        value={tillDate}
                                        min={fromDate}
                                        onChange={e => setTillDate(e.target.value)}
                                    />
                                </div>
                                <button
                                    className="w-full md:w-auto min-w-[140px] py-3 px-4 rounded-lg font-medium transition-colors text-sm bg-blue-600 hover:bg-blue-700 text-white shadow"
                                    style={{height: '48px'}} 
                                    onClick={() => { setShowTimecard(true); setFilterKey(k => k+1); }}
                                >
                                    View Timecard
                                </button>
                            </div>
                            {/* Table */}
                            {/* Always show the table for the current range; button just updates the range */}
                            <WeeklyActivityTable
                                key={filterKey}
                                userId={userProfile.employee_id}
                                fromDate={fromDate}
                                tillDate={tillDate}
                            />
                        </div>
                    </div>
                </div>

                {/* Quick Stats removed as requested */}
            </div>
        </div>
    );
};

// Weekly Activity Table Component
const WeeklyActivityTable = ({ userId, fromDate, tillDate }) => {
    const [weeklyData, setWeeklyData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cumulativeHours, setCumulativeHours] = useState(0);

    useEffect(() => {
        fetchWeeklyData();
    }, [userId, fromDate, tillDate]);

    const fetchWeeklyData = async () => {
        try {
            setLoading(true);
            const start = new Date(fromDate);
            const end = new Date(tillDate);
            const days = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                days.push(new Date(d));
            }

            const weeklyScheduleData = [];
            let totalCumulativeHours = 0;

            for (const date of days) {
                const dateStr = date.toISOString().split('T')[0];
                // Fetch schedule data for this date
                const { data, error } = await supabase
                    .from('store_schedule')
                    .select('time_log')
                    .eq('employee_id', userId)
                    .gte('start_time', `${dateStr}T00:00:00`)
                    .lte('start_time', `${dateStr}T23:59:59`)
                    .single();

                const dayData = {
                    date: new Date(date),
                    clockedIn: null,
                    breakIn: null,
                    breakOut: null,
                    clockedOut: null,
                    hoursWorked: 0,
                    tillDateHours: 0
                };

                if (data && data.time_log) {
                    const timeLogs = Array.isArray(data.time_log) ? data.time_log : [];
                    // Find the times for each event
                    const clockIn = timeLogs.find(log => log.type === 'clock_in');
                    const clockOut = timeLogs.find(log => log.type === 'clock_out');
                    const breakStart = timeLogs.find(log => log.type === 'break_start');
                    const breakEnd = timeLogs.find(log => log.type === 'break_end');

                    dayData.clockedIn = clockIn ? new Date(clockIn.timestamp) : null;
                    dayData.clockedOut = clockOut ? new Date(clockOut.timestamp) : null;
                    dayData.breakIn = breakStart ? new Date(breakStart.timestamp) : null;
                    dayData.breakOut = breakEnd ? new Date(breakEnd.timestamp) : null;

                    // Calculate hours worked
                    if (clockIn && clockOut) {
                        const workMilliseconds = new Date(clockOut.timestamp) - new Date(clockIn.timestamp);
                        let breakMilliseconds = 0;
                        if (breakStart && breakEnd) {
                            breakMilliseconds = new Date(breakEnd.timestamp) - new Date(breakStart.timestamp);
                        }
                        const totalWorkMilliseconds = workMilliseconds - breakMilliseconds;
                        dayData.hoursWorked = Math.max(0, totalWorkMilliseconds / (1000 * 60 * 60)); // Convert to hours
                    }
                }

                totalCumulativeHours += dayData.hoursWorked;
                dayData.tillDateHours = totalCumulativeHours;
                weeklyScheduleData.push(dayData);
            }

            setWeeklyData(weeklyScheduleData);
            setCumulativeHours(totalCumulativeHours);
        } catch (error) {
            console.error('Error fetching weekly data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (date) => {
        return date ? date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        }) : '-';
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    const formatHours = (hours) => {
        return hours > 0 ? `${hours.toFixed(1)}h` : '0h';
    };

    if (loading) {
        return (
            <div className="text-center py-8 text-gray-500">Loading data...</div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-gray-50">
                        <th className="px-2 py-2 text-left font-medium text-gray-700">Date</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-700">Clock In</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-700">Break In</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-700">Break Out</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-700">Clock Out</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-700">Hrs Worked</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-700">Till Date</th>
                    </tr>
                </thead>
                <tbody>
                    {weeklyData.map((day, index) => (
                        <tr key={index} className={`border-b border-gray-100 ${
                            day.date.toDateString() === new Date().toDateString() ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`} style={{ height: '48px' }}>
                            <td className="px-2 py-2 font-medium text-gray-700 align-middle">
                                {formatDate(day.date)}
                            </td>
                            <td className="px-2 py-2 text-center text-gray-700 align-middle">
                                {formatTime(day.clockedIn)}
                            </td>
                            <td className="px-2 py-2 text-center text-gray-700 align-middle">
                                {formatTime(day.breakIn)}
                            </td>
                            <td className="px-2 py-2 text-center text-gray-700 align-middle">
                                {formatTime(day.breakOut)}
                            </td>
                            <td className="px-2 py-2 text-center text-gray-700 align-middle">
                                {formatTime(day.clockedOut)}
                            </td>
                            <td className="px-2 py-2 text-center font-medium text-gray-800 align-middle">
                                {formatHours(day.hoursWorked)}
                            </td>
                            <td className="px-2 py-2 text-center font-medium text-blue-700 align-middle">
                                {formatHours(day.tillDateHours)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="mt-2 text-right">
                <span className="text-xs text-gray-500">
                    Total Hours: <span className="font-medium text-gray-700">{formatHours(cumulativeHours)}</span>
                </span>
            </div>
        </div>
    );
};

export default ClockDashboard;
