import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import CalendarWidget from '../components/CalendarWidget';
import WeeklyCalendar from '../components/WeeklyCalendar';
import { utcToLocal, localToUTC } from '../utils/timezoneUtils';

const getWeekDates = (offset = 0) => {
    const dates = [];
    const today = new Date();
    const dayOfWeek = today.getDay();
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
    const [storeTimezone, setStoreTimezone] = useState('America/Toronto'); // Default fallback
    const weekDates = getWeekDates(weekOffset);

    useEffect(() => {
        const fetchManagerStore = async () => {
            const { data, error } = await supabase
                .from('employee')
                .select('store_id, store:store_id(timezone)')
                .eq('email', user.email)
                .single();

            if (!error && data?.store_id) {
                setStoreId(data.store_id);
                if (data.store?.timezone) {
                    setStoreTimezone(data.store.timezone);
                }
            } else {
                setStoreId(null);
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
                // Convert UTC to local time for display
                const localStart = utcToLocal(entry.start_time, storeTimezone, 'HH:mm');
                const localEnd = utcToLocal(entry.end_time, storeTimezone, 'HH:mm');
                const dateKey = utcToLocal(entry.start_time, storeTimezone, 'yyyy-MM-dd');
                if (!updatedSchedule[empId]) updatedSchedule[empId] = {};
                updatedSchedule[empId][dateKey] = {
                    checked: true,
                    start: localStart,
                    end: localEnd,
                    existing: true,
                    editable: false,
                    originalStartTimeUTC: entry.start_time // Store original UTC start_time for update
                };
            });

            setScheduleData(updatedSchedule);
        };

        fetchEmployeesAndSchedules();
    }, [storeId, weekOffset, user]);

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
                    // Convert local time to UTC for storage
                    const utcStart = localToUTC(`${dateString}T${shift.start}`, storeTimezone);
                    const utcEnd = localToUTC(`${dateString}T${shift.end}`, storeTimezone);
                    const entry = {
                        store_id: storeId,
                        employee_id: parseInt(empId),
                        start_time: utcStart,
                        end_time: utcEnd,
                        originalStartTimeUTC: shift.originalStartTimeUTC // Pass along for update
                    };
                    if (shift.existing) {
                        entriesToUpdate.push(entry);
                    } else {
                        entriesToInsert.push(entry);
                    }
                }
            }
        }

        for (const entry of entriesToUpdate) {
            const { error } = await supabase
                .from('store_schedule')
                .update({ start_time: entry.start_time, end_time: entry.end_time })
                .eq('store_id', entry.store_id)
                .eq('employee_id', entry.employee_id)
                .eq('start_time', entry.originalStartTimeUTC); // Use original UTC start_time for update
            if (error) {
                setMessage('❌ Failed to update schedule.');
                setSaving(false);
                return;
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
                    <div className="layout-content-container flex flex-col w-80">
                        <h2 className=" text-2xl font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Schedule</h2>
                        <div className="flex flex-wrap items-center justify-center gap-6 p-4">
                            <div className="flex min-w-72 max-w-[336px] flex-1 flex-col gap-0.5">
                                <WeeklyCalendar
                                />
                            </div>
                        </div>

                        <h2 className="text-[#121416] text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Filters</h2>
                        <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
                            <label className="flex flex-col min-w-40 flex-1">
                                <select
                                    className="form-input flex w-full rounded-xl text-[#121416] border border-[#dde1e3] bg-white h-14 px-4 text-base"
                                    onChange={(e) => setSelectedEmployee(e.target.value)}
                                    value={selectedEmployee}
                                >
                                    <option value="">All Employees</option>
                                    {employees.map(emp => (
                                        <option key={emp.employee_id} value={emp.employee_id}>
                                            {emp.first_name} {emp.last_name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>

                    <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
                        <div className="flex flex-wrap justify-end gap-3 p-4">
                            <div className="flex space-x-3">
                                <button onClick={() => setWeekOffset(weekOffset - 1)} className="px-4 py-2 border border-[#dde1e3] rounded-xl hover:bg-gray-50 transition text-sm font-medium">← Prev Week</button>
                                <button onClick={() => setWeekOffset(weekOffset + 1)} className="px-4 py-2 border border-[#dde1e3] rounded-xl hover:bg-gray-50 transition text-sm font-medium">Next Week →</button>
                            </div>
                        </div>
                        {message && <p className="mb-6 text-sm text-center text-red-600 bg-red-50 p-3 rounded-lg mx-4">{message}</p>}

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
                                                            <td key={dateString} className="px-4 py-3 text-sm text-[#6a7681] h-12 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleCellClick(emp.employee_id, dateString)}>
                                                                {shift?.checked ? (
                                                                    shift.editable || isEditing ? (
                                                                        <div className="flex flex-col gap-1">
                                                                            <input
                                                                                type="text"
                                                                                value={shift.start || ''}
                                                                                onChange={(e) => handleTimeChange(emp.employee_id, dateString, 'start', e.target.value)}
                                                                                onBlur={handleInputBlur}
                                                                                className="w-full text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                placeholder="Start (e.g. 09:00)"
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
                                                                        <span className="text-[#121416] font-medium">{shift.start} - {shift.end}</span>
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

                        <div className="flex justify-end py-4 ">
                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="flex min-w-[84px] max-w-[200px] items-center justify-center rounded-xl h-10 px-4 bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50"   >
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
