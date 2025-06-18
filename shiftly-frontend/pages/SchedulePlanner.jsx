import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

// Generate time slots (24-hour format, 30 min steps)
const generate24hTimes = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const h = hour.toString().padStart(2, '0');
            const m = minute.toString().padStart(2, '0');
            times.push(`${h}:${m}`);
        }
    }
    return times;
};

const timeOptions = generate24hTimes();

const getWeekDates = (offset = 0) => {
    const dates = [];
    const today = new Date();
    const dayOfWeek = today.getDay();
    const offsetToMonday = ((8 - dayOfWeek) % 7) || 7;
    const baseDate = new Date(today);
    baseDate.setDate(today.getDate() + offsetToMonday + offset * 7);

    for (let i = 0; i < 7; i++) {
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        const label = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        dates.push({ dateString, label });
    }

    return dates;
};

const SchedulePlanner = () => {
    const { user, isAuthenticated } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [storeId, setStoreId] = useState(null);
    const [scheduleData, setScheduleData] = useState({});
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [weekOffset, setWeekOffset] = useState(0);
    const weekDates = getWeekDates(weekOffset);

    useEffect(() => {
        if (!isAuthenticated || user.role_id !== 3) return;

        const fetchManagerStore = async () => {
            const { data } = await supabase
                .from('employee')
                .select('store_id')
                .eq('email', user.email)
                .single();

            if (data?.store_id) setStoreId(data.store_id);
        };

        fetchManagerStore();
    }, [user, isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated || user.role_id !== 3 || !storeId) return;

        const fetchEmployeesAndSchedules = async () => {
            const { data: employeeData } = await supabase
                .from('employee')
                .select('employee_id, first_name, last_name')
                .eq('store_id', storeId);
            if (employeeData) setEmployees(employeeData);

            const startDate = weekDates[0].dateString;
            const endDate = weekDates[6].dateString;

            const { data: scheduleEntries } = await supabase
                .from('store_schedule')
                .select('employee_id, start_time, end_time')
                .eq('store_id', storeId)
                .gte('start_time', `${startDate}T00:00`)
                .lte('end_time', `${endDate}T23:59`);

            if (scheduleEntries) {
                const updatedSchedule = {};

                scheduleEntries.forEach(entry => {
                    const empId = entry.employee_id;
                    const dateKey = entry.start_time.split('T')[0];
                    const startTime = entry.start_time.split('T')[1].slice(0, 5);
                    const endTime = entry.end_time.split('T')[1].slice(0, 5);

                    if (!updatedSchedule[empId]) updatedSchedule[empId] = {};
                    updatedSchedule[empId][dateKey] = {
                        checked: true,
                        start: startTime,
                        end: endTime,
                        existing: true,
                        editable: false
                    };
                });

                setScheduleData(updatedSchedule);
            }
        };

        fetchEmployeesAndSchedules();
    }, [storeId, weekOffset, isAuthenticated, user]);

    const handleCheckboxChange = (empId, date) => {
        setScheduleData(prev => ({
            ...prev,
            [empId]: {
                ...prev[empId],
                [date]: {
                    ...prev[empId]?.[date],
                    checked: !prev[empId]?.[date]?.checked
                }
            }
        }));
    };

    const handleTimeChange = (empId, date, field, value) => {
        setScheduleData(prev => ({
            ...prev,
            [empId]: {
                ...prev[empId],
                [date]: {
                    ...prev[empId]?.[date],
                    [field]: value
                }
            }
        }));
    };

    const handleSubmit = async () => {
        if (!window.confirm('Are you sure you want to save the schedule?')) return;

        setSaving(true);
        let entries = [];

        for (const empId in scheduleData) {
            for (const { dateString } of weekDates) {
                const shift = scheduleData[empId]?.[dateString];
                if (shift?.checked) {
                    if (!shift.start || !shift.end) {
                        setMessage(`Missing time for ${dateString} on employee ${empId}`);
                        setSaving(false);
                        return;
                    }

                    entries.push({
                        store_id: storeId,
                        employee_id: parseInt(empId),
                        start_time: `${dateString}T${shift.start}`,
                        end_time: `${dateString}T${shift.end}`
                    });
                }
            }
        }

        const { error } = await supabase.from('store_schedule').insert(entries);

        if (error) {
            console.error(error);
            setMessage('❌ Failed to save schedule.');
        } else {
            setMessage('✅ Schedule saved successfully.');
            setScheduleData({});
        }

        setSaving(false);
    };

    // ✅ Block access if not authenticated or not a manager
    if (!isAuthenticated || user.role_id !== 3) {
        return (
            <div className="p-6 text-red-500 text-center">
                Access Denied: Managers Only
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-3xl font-bold">Schedule Planner</h2>
                <div className="space-x-2">
                    <button onClick={() => setWeekOffset(weekOffset - 1)} className="px-3 py-1 border rounded">← Prev Week</button>
                    <button onClick={() => setWeekOffset(weekOffset + 1)} className="px-3 py-1 border rounded">Next Week →</button>
                </div>
            </div>

            {message && <p className="mb-4 text-sm text-center text-red-600">{message}</p>}

            {employees.map(emp => (
                <div key={emp.employee_id} className="mb-8 border border-gray-200 rounded-lg shadow-sm p-4">
                    <h3 className="text-xl font-semibold mb-3">{emp.first_name} {emp.last_name}</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm text-left">
                            <thead>
                                <tr>
                                    {weekDates.map(({ dateString, label }) => (
                                        <th key={dateString} className="px-3 py-2 font-semibold text-gray-700">
                                            {label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    {weekDates.map(({ dateString }) => {
                                        const shift = scheduleData[emp.employee_id]?.[dateString];
                                        return (
                                            <td key={dateString} className="px-3 py-2 border-t align-top">
                                                <label className="flex items-center space-x-2 mb-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={shift?.checked || false}
                                                        onChange={() => handleCheckboxChange(emp.employee_id, dateString)}
                                                    />
                                                    <span className="text-xs">Shift</span>
                                                </label>

                                                {shift?.checked && (
                                                    <div className="space-y-1">
                                                        {shift.existing && !shift.editable ? (
                                                            <div className="text-xs">
                                                                <p>{shift.start} - {shift.end}</p>
                                                                <button
                                                                    className="text-blue-500 underline text-xs mt-1"
                                                                    onClick={() => {
                                                                        setScheduleData(prev => ({
                                                                            ...prev,
                                                                            [emp.employee_id]: {
                                                                                ...prev[emp.employee_id],
                                                                                [dateString]: {
                                                                                    ...prev[emp.employee_id][dateString],
                                                                                    editable: true
                                                                                }
                                                                            }
                                                                        }));
                                                                    }}
                                                                >
                                                                    Edit
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <select
                                                                    value={shift.start || ''}
                                                                    onChange={(e) => handleTimeChange(emp.employee_id, dateString, 'start', e.target.value)}
                                                                    className="w-full border rounded p-1 text-xs"
                                                                >
                                                                    <option value="">--</option>
                                                                    {timeOptions.map(time => (
                                                                        <option key={time} value={time}>{time}</option>
                                                                    ))}
                                                                </select>

                                                                <select
                                                                    value={shift.end || ''}
                                                                    onChange={(e) => handleTimeChange(emp.employee_id, dateString, 'end', e.target.value)}
                                                                    className="w-full border rounded p-1 text-xs"
                                                                >
                                                                    <option value="">--</option>
                                                                    {timeOptions.map(time => (
                                                                        <option key={time} value={time}>{time}</option>
                                                                    ))}
                                                                </select>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}

            <button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
                {saving ? 'Saving...' : 'Save Schedule'}
            </button>
        </div>
    );
};

export default SchedulePlanner;
