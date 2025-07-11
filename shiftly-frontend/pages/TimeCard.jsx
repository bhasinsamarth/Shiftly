import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import CalendarWidget from '../components/CalendarWidget';
import dayjs from 'dayjs';
import { utcToLocal } from '../utils/timezoneUtils';

const Timecards = () => {
    const { user } = useAuth();
    const [storeId, setStoreId] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [date, setDate] = useState(dayjs().startOf('day'));
    const [timecardData, setTimecardData] = useState({});
    const [editing, setEditing] = useState({});
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);
    const [editingCell, setEditingCell] = useState(null);
    const [storeTimezone, setStoreTimezone] = useState('America/Toronto'); // Default fallback

    useEffect(() => {
        const fetchStore = async () => {
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
            }
        };
        if (user) fetchStore();
    }, [user]);

    useEffect(() => {
        if (!storeId) return;

        const fetchData = async () => {
            const start = date.startOf('day');
            const end = date.endOf('day');

            const { data: employeesData } = await supabase
                .from('employee')
                .select('employee_id, first_name, last_name')
                .eq('store_id', storeId);

            setEmployees(employeesData || []);

            const { data: scheduleData } = await supabase
                .from('store_schedule')
                .select('employee_id, time_log')
                .eq('store_id', storeId);



            const formatted = {};

            (scheduleData || []).forEach(({ employee_id, time_log }) => {
                console.log(employee_id, 'Raw logs from DB:', time_log);
                const logsForDay = (time_log || []).filter(entry => {
                    const entryDate = dayjs(entry.timestamp);
                    return entryDate.isSame(start, 'day');
                });

                const shifts = {};
                logsForDay.forEach(entry => {
                    // Convert UTC timestamp to local time string for display
                    const localTime = utcToLocal(entry.timestamp, storeTimezone, 'HH:mm');
                    shifts[entry.type] = localTime;
                });

                formatted[employee_id] = shifts;
            });

            setTimecardData(formatted);

        };

        fetchData();
    }, [storeId, date]);

    // const handleChange = (empId, type, value) => {
    //     setTimecardData(prev => ({
    //         ...prev,
    //         [empId]: {
    //             ...prev[empId],
    //             [type]: value
    //         }
    //     }));
    //     setEditing(prev => ({ ...prev, [empId]: true }));
    // };

    const saveChanges = async () => {
        setSaving(true);

        for (const empId in timecardData) {
            if (!editing[empId]) continue;

            const updatedLogs = [];
            const entry = timecardData[empId];
            for (const type of ['clock_in', 'break_start', 'break_end', 'clock_out']) {
                if (entry[type]) {
                    // Convert local time back to UTC for storage
                    const localDateTime = dayjs(date.format('YYYY-MM-DD') + 'T' + entry[type]);
                    // Use storeTimezone to get UTC ISO string
                    const utcDateTime = dayjs.tz ? dayjs.tz(localDateTime, storeTimezone).utc().toISOString() : localDateTime.toISOString();
                    updatedLogs.push({
                        type,
                        timestamp: utcDateTime,
                        latitude: 0,
                        longitude: 0,
                        distance_from_store: 0
                    });
                }
            }

            const { data: existingData, error: fetchErr } = await supabase
                .from('store_schedule')
                .select('time_log')
                .eq('employee_id', empId)
                .eq('store_id', storeId)
                .single();

            let newTimeLog = (existingData?.time_log || []).filter(log => {
                return !dayjs(log.timestamp).isSame(date, 'day');
            });

            newTimeLog = [...newTimeLog, ...updatedLogs];

            const { error } = await supabase
                .from('store_schedule')
                .update({ time_log: newTimeLog })
                .eq('employee_id', empId)
                .eq('store_id', storeId);

            if (error) {
                console.error('Save error:', error);
                setMessage('❌ Failed to save changes.');
                setSaving(false);
                return;
            }
        }

        setMessage('✅ Changes saved successfully.');
        setSaving(false);
        setEditing({});
    };

    // const formatTime = (time) => {
    //     return time ? time : <span className="text-gray-400">No data</span>;
    // };

    const handleInputChange = (empId, type, value) => {
        setTimecardData(prev => ({
            ...prev,
            [empId]: {
                ...prev[empId],
                [type]: value
            }
        }));
        setEditing(prev => ({ ...prev, [empId]: true }));
    };

    const handleCellClick = (empId, type) => {
        setEditingCell(`${empId}-${type}`);
    };

    const handleInputBlur = () => {
        setEditingCell(null);
    };

    const handleCalendarDateChange = (selectedDateObj) => {
        setDate(dayjs(selectedDateObj).startOf('day'));
    };

    return (
        <div className="lg:ml-[16.67%] min-h-screen bg-white font-sans">
            <div className="layout-container flex h-full grow flex-col">
                <div className="gap-1 pr-6 flex flex-1 justify-center py-5">
                    <div className="layout-content-container flex flex-col w-80">
                        <h2 className=" text-2xl font-bold leading-tight px-4 pb-3 pt-5">Timecard</h2>
                        <div className="flex flex-wrap items-center justify-center gap-6 p-4">
                            <div className="flex min-w-72 max-w-[336px] flex-1 flex-col gap-0.5">
                                <CalendarWidget onDateClick={handleCalendarDateChange} selectedDate={date.toDate()} year={date.year()} month={date.month()} />
                            </div>
                        </div>
                        <h2 className="text-[#121416] text-[22px] font-bold leading-tight px-4 pt-6">Filters</h2>
                        <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
                            <label className="flex flex-col min-w-40 flex-1">
                                <select
                                    className="form-input flex w-full rounded-xl text-[#121416] border border-[#dde1e3] bg-white h-14 px-4 text-base"
                                    value={selectedEmployee}
                                    onChange={e => setSelectedEmployee(e.target.value)}
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

                    <div className="layout-content-container flex flex-col flex-1 max-w-[960px]">
                        <div className="flex flex-wrap justify-between items-center px-4 pt-5">
                            <div>
                                <span className=" font-semibold text-gray-700">
                                    {date.format('dddd, MMMM D, YYYY')}
                                </span>
                            </div>
                            <div className="flex space-x-3">
                                <button
                                    className="px-4 py-2 border border-[#dde1e3] rounded-xl hover:bg-gray-50 transition text-sm font-medium"
                                    onClick={() => setDate(prev => prev.subtract(1, 'day'))}
                                >
                                    ← Prev Day
                                </button>
                                <button
                                    className="px-4 py-2 border border-[#dde1e3] rounded-xl hover:bg-gray-50 transition text-sm font-medium"
                                    onClick={() => setDate(prev => prev.add(1, 'day'))}
                                >
                                    Next Day →
                                </button>
                            </div>
                        </div>

                        <div className="px-4 pt-4">
                            <div className="overflow-x-auto border border-[#dde1e3] rounded-xl">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Employee</th>
                                            <th className="px-4 py-2 text-left">Clock In</th>
                                            <th className="px-4 py-2 text-left">Break Start</th>
                                            <th className="px-4 py-2 text-left">Break End</th>
                                            <th className="px-4 py-2 text-left">Clock Out</th>
                                            <th className="px-4 py-2 text-left">Total Hours</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employees
                                            .filter(emp => !selectedEmployee || selectedEmployee == emp.employee_id)
                                            .map(emp => {
                                                const shifts = timecardData[emp.employee_id] || {};
                                                const calcHours = () => {
                                                    if (shifts.clock_in && shifts.clock_out) {
                                                        const inTime = dayjs(`${date.format('YYYY-MM-DD')}T${shifts.clock_in}`);
                                                        const outTime = dayjs(`${date.format('YYYY-MM-DD')}T${shifts.clock_out}`);
                                                        let diff = outTime.diff(inTime, 'minute');
                                                        if (shifts.break_start && shifts.break_end) {
                                                            const breakIn = dayjs(`${date.format('YYYY-MM-DD')}T${shifts.break_start}`);
                                                            const breakOut = dayjs(`${date.format('YYYY-MM-DD')}T${shifts.break_end}`);
                                                            diff -= breakOut.diff(breakIn, 'minute');
                                                        }
                                                        return `${Math.floor(diff / 60)}h ${diff % 60}m`;
                                                    }
                                                    return '-';
                                                };

                                                return (
                                                    <tr key={emp.employee_id} className="border-t border-[#dde1e3] hover:bg-gray-50 transition h-12">
                                                        <td className="px-4 py-2 font-medium">{emp.first_name} {emp.last_name}</td>
                                                        {['clock_in', 'break_start', 'break_end', 'clock_out'].map(type => {
                                                            const key = `${emp.employee_id}-${type}`;
                                                            const isEditing = editingCell === key;
                                                            return (
                                                                <td
                                                                    key={type}
                                                                    className="px-4 py-2 cursor-pointer"
                                                                    title="Click to edit"
                                                                    onClick={() => handleCellClick(emp.employee_id, type)}
                                                                >
                                                                    {isEditing ? (
                                                                        <input
                                                                            className="w-full border rounded px-1 text-sm focus:ring-blue-500 focus:outline-none"
                                                                            type="text"
                                                                            value={shifts[type] || ''}
                                                                            onChange={e => handleInputChange(emp.employee_id, type, e.target.value)}
                                                                            onBlur={handleInputBlur}
                                                                            placeholder="--:--"
                                                                            autoFocus
                                                                        />
                                                                    ) : (
                                                                        <span className={shifts[type] ? '' : 'text-gray-400'}>{shifts[type] || 'No data'}</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-4 py-2 text-gray-700">{calcHours()}</td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end py-4">
                                <button
                                    onClick={saveChanges}
                                    disabled={saving}
                                    className="flex min-w-[84px] max-w-[200px] items-center justify-center rounded-xl h-10 px-4 bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                    <span className="truncate">{saving ? 'Saving...' : 'Save Changes'}</span>
                                </button>
                            </div>

                            {message && <div className="text-center text-sm text-blue-600 py-2">{message}</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Timecards;
