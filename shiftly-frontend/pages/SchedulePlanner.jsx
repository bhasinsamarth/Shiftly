import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import CalendarWidget from '../components/CalendarWidget';

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
    const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
    // Calculate the date for Sunday of the current week, then add offset*7 days
    const baseDate = new Date(today);
    baseDate.setDate(today.getDate() - dayOfWeek + offset * 7);
    baseDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        const label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        dates.push({ dateString, label });
    }

    return dates;
};

const SchedulePlanner = () => {
    const { user } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [storeId, setStoreId] = useState(null);
    const [scheduleData, setScheduleData] = useState({});
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [weekOffset, setWeekOffset] = useState(0);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [editingCell, setEditingCell] = useState(null);
    const weekDates = getWeekDates(weekOffset);

    useEffect(() => {
        const fetchManagerStore = async () => {
            const { data, error } = await supabase
                .from('employee')
                .select('store_id')
                .eq('email', user.email)
                .single();

            if (error || !data?.store_id) {
                setStoreId(null);
            } else {
                setStoreId(data.store_id);
            }
        };
        if (user) fetchManagerStore();
    }, [user]);

    useEffect(() => {
        if (!storeId) return;

        const fetchEmployeesAndSchedules = async () => {
            const { data: employeeData, error: empErr } = await supabase
                .from('employee')
                .select('employee_id, first_name, last_name')
                .eq('store_id', storeId);
            if (empErr) {
                setEmployees([]);
                return;
            }
            setEmployees(employeeData || []);

            const startDate = weekDates[0].dateString;
            const endDate = weekDates[6].dateString;

            const { data: scheduleEntries, error: schedErr } = await supabase
                .from('store_schedule')
                .select('employee_id, start_time, end_time')
                .eq('store_id', storeId)
                .gte('start_time', `${startDate}T00:00`)
                .lte('end_time', `${endDate}T23:59`);

            if (schedErr) {
                setScheduleData({});
                return;
            }

            const updatedSchedule = {};
            (scheduleEntries || []).forEach(entry => {
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
        };

        fetchEmployeesAndSchedules();

        // eslint-disable-next-line
    }, [storeId, weekOffset, user]);

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

    const handleCellClick = (empId, dateString) => {
        const shift = scheduleData[empId]?.[dateString];
        if (!shift?.checked) {
            // Create a new shift if it doesn't exist
            setScheduleData(prev => ({
                ...prev,
                [empId]: {
                    ...prev[empId],
                    [dateString]: {
                        checked: true,
                        start: '',
                        end: '',
                        existing: false,
                        editable: true
                    }
                }
            }));
            setEditingCell(`${empId}-${dateString}`);
        } else if (shift.existing && !shift.editable) {
            // Make existing shift editable
            setScheduleData(prev => ({
                ...prev,
                [empId]: {
                    ...prev[empId],
                    [dateString]: {
                        ...prev[empId][dateString],
                        editable: true
                    }
                }
            }));
            setEditingCell(`${empId}-${dateString}`);
        }
    };

    const handleInputBlur = () => {
        setEditingCell(null);
    };

    const handleSubmit = async () => {
        if (!window.confirm('Are you sure you want to save the schedule?')) return;

        setSaving(true);
        let entriesToInsert = [];
        let entriesToUpdate = [];

        for (const empId in scheduleData) {
            for (const { dateString } of weekDates) {
                const shift = scheduleData[empId]?.[dateString];
                if (shift?.checked) {
                    if (!shift.start || !shift.end) {
                        setMessage(`Missing time for ${dateString} on employee ${empId}`);
                        setSaving(false);
                        return;
                    }

                    const entry = {
                        store_id: storeId,
                        employee_id: parseInt(empId),
                        start_time: `${dateString}T${shift.start}`,
                        end_time: `${dateString}T${shift.end}`
                    };

                    if (shift.existing) {
                        entriesToUpdate.push(entry);
                    } else {
                        entriesToInsert.push(entry);
                    }
                }
            }
        }

        if (entriesToUpdate.length > 0) {
            for (const entry of entriesToUpdate) {
                const { error } = await supabase
                    .from('store_schedule')
                    .update({ start_time: entry.start_time, end_time: entry.end_time })
                    .eq('store_id', entry.store_id)
                    .eq('employee_id', entry.employee_id)
                    .eq('start_time', entry.start_time);

                if (error) {
                    setMessage('❌ Failed to update schedule.');
                    setSaving(false);
                    return;
                }
            }
        }

        if (entriesToInsert.length > 0) {
            const { error } = await supabase.from('store_schedule').insert(entriesToInsert);

            if (error) {
                setMessage('❌ Failed to save schedule.');
                setSaving(false);
                return;
            }
        }

        setMessage('✅ Schedule saved successfully.');
        setScheduleData({});
        setSaving(false);
    };

    // Block access if not authenticated or not a manager
    if (!user || user.role_id !== 3) {
        return (
            <div className="p-6 text-red-500 text-center">
                Access Denied: Managers Only
            </div>
        );
    }

    return (
        <div className="lg:ml-[16.67%] min-h-screen bg-white" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
            <div className="layout-container flex h-full grow flex-col">
                <div className="gap-1 pr-6 flex flex-1 justify-center py-5">
                    {/* Calendar Section */}
                    <div className="layout-content-container flex flex-col w-80">
                        <h2 className="text-[#121416] text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">
                            Schedule
                        </h2>
                        <div className="flex flex-wrap items-center justify-center gap-6 p-4">
                            <div className="flex min-w-72 max-w-[336px] flex-1 flex-col gap-0.5">
                                <CalendarWidget />
                            </div>
                        </div>

                        {/* Filters Section */}
                        <h2 className="text-[#121416] text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">
                            Filters
                        </h2>
                        <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
                            <label className="flex flex-col min-w-40 flex-1">
                                <select 
                                    className="form-input flex w-full rounded-xl text-[#121416] border border-[#dde1e3] bg-white h-14 px-4 text-base"
                                    onChange={(e) => setSelectedEmployee(e.target.value)}
                                    value={selectedEmployee}
                                >
                                    <option value="">All Employees</option>
                                    {employees.map(emp => (
                                        <option key={emp.employee_id} value={emp.employee_id}>{emp.first_name} {emp.last_name}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>

                    {/* Schedule Table */}
                    <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
                        <div className="flex flex-wrap justify-between gap-3 p-4">
                            <div className="flex min-w-72 flex-col gap-3">
                                <p className="text-[#121416] text-[32px] font-bold">Schedule</p>
                                <p className="text-[#6a7681] text-sm">Manage and view employee schedules</p>
                            </div>
                            <div className="flex space-x-3">
                                <button onClick={() => setWeekOffset(weekOffset - 1)} className="px-4 py-2 border border-[#dde1e3] rounded-xl hover:bg-gray-50 transition text-sm font-medium">← Prev Week</button>
                                <button onClick={() => setWeekOffset(weekOffset + 1)} className="px-4 py-2 border border-[#dde1e3] rounded-xl hover:bg-gray-50 transition text-sm font-medium">Next Week →</button>
                            </div>
                        </div>
                        
                        <div className="pb-3">
                            <div className="flex border-b border-[#dde1e3] px-4 gap-8">
                                {["Day", "Week", "Month"].map((tab) => (
                                    <a
                                        key={tab}
                                        href="#"
                                        className={`flex flex-col items-center pb-[13px] pt-4 border-b-[3px] ${
                                            tab === "Week"
                                                ? "border-b-[#121416] text-[#121416]"
                                                : "border-b-transparent text-[#6a7681]"
                                        }`}
                                    >
                                        <p className="text-sm font-bold tracking-[0.015em]">{tab}</p>
                                    </a>
                                ))}
                            </div>
                        </div>

                        {message && <p className="mb-6 text-sm text-center text-red-600 bg-red-50 p-3 rounded-lg mx-4">{message}</p>}

                        {/* Schedule table */}
                        <div className="px-4 py-3">
                            <div className="overflow-x-auto border border-[#dde1e3] rounded-xl">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-white">
                                            <th className="px-4 py-3 text-left text-sm font-medium text-[#121416]">Employee</th>
                                            {weekDates.map(({ label }) => (
                                                <th key={label} className="px-4 py-3 text-left text-sm font-medium text-[#121416]">{label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employees
                                            .filter(emp => !selectedEmployee || emp.employee_id === parseInt(selectedEmployee))
                                            .map(emp => (
                                                <tr key={emp.employee_id} className="border-t border-[#dde1e3] hover:bg-gray-50 transition h-12">
                                                    <td className="px-4 py-3 text-sm text-[#121416] font-medium h-12">
                                                        {emp.first_name} {emp.last_name}
                                                    </td>
                                                    {weekDates.map(({ dateString }) => {
                                                        const shift = scheduleData[emp.employee_id]?.[dateString];
                                                        const isEditing = editingCell === `${emp.employee_id}-${dateString}`;
                                                        return (
                                                            <td 
                                                                key={dateString} 
                                                                className="px-4 py-3 text-sm text-[#6a7681] h-12 cursor-pointer hover:bg-gray-100 transition"
                                                                onClick={() => handleCellClick(emp.employee_id, dateString)}
                                                            >
                                                                {shift?.checked ? (
                                                                    shift.editable || isEditing ? (
                                                                        <div className="flex flex-col gap-1">
                                                                            <input
                                                                                type="text"
                                                                                value={shift.start || ''}
                                                                                onChange={(e) => handleTimeChange(emp.employee_id, dateString, 'start', e.target.value)}
                                                                                onBlur={handleInputBlur}
                                                                                className="w-full text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                placeholder="Start (e.g. 9:00)"
                                                                                autoFocus={isEditing}
                                                                            />
                                                                            <input
                                                                                type="text"
                                                                                value={shift.end || ''}
                                                                                onChange={(e) => handleTimeChange(emp.employee_id, dateString, 'end', e.target.value)}
                                                                                onBlur={handleInputBlur}
                                                                                className="w-full text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                placeholder="End (e.g. 17:00)"
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[#121416] font-medium">
                                                                            {shift.start} - {shift.end}
                                                                        </span>
                                                                    )
                                                                ) : (
                                                                    <span className="text-[#9ca3af] opacity-60">Off</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="px-4 py-3">
                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="flex min-w-[84px] max-w-[200px] items-center justify-center rounded-xl h-10 px-4 bg-[#dce8f3] text-[#121416] text-sm font-bold hover:bg-[#c8daf0] transition disabled:opacity-50"
                            >
                                <span className="truncate">{saving ? 'Saving...' : 'Save Schedule'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SchedulePlanner;
