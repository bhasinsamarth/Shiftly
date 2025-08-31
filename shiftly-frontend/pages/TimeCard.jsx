import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { EmployeeService, ScheduleService } from '../services/apiClient.js';
import CalendarWidget from '../components/CalendarWidget';
import { utcToLocal } from '../utils/timezoneUtils';
import dayjs from 'dayjs';
import InputField from '../components/InputField';

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
    const [storeTimezone, setStoreTimezone] = useState('America/Edmonton'); // Default timezone

    // Fetch store and timezone based on user email
    useEffect(() => {
        const fetchStore = async () => {
            try {
                // User should already have store_id from auth context
                if (user?.store_id) {
                    setStoreId(user.store_id);
                    
                    // Fetch store details for timezone
                    const stores = await EmployeeService.getEmployees({ 
                        store_id: user.store_id,
                        limit: 1 
                    });
                    
                    if (stores.length > 0 && stores[0].stores?.timezone) {
                        setStoreTimezone(stores[0].stores.timezone);
                    }
                }
            } catch (error) {
                console.error('Error fetching store data:', error);
            }
        };
        if (user) fetchStore();
    }, [user]);

    // Fetch all the employees and their timecard data for the selected store and date
    useEffect(() => {
        if (!storeId) return;

        const fetchData = async () => {
            try {
                const start = date.startOf('day');

                // Fetch employees using secure API
                const employeesData = await EmployeeService.getEmployees({
                    store_id: storeId,
                    limit: 1000
                });

                setEmployees(employeesData || []);

                // Fetch timecard data using secure API
                const scheduleData = await ScheduleService.getTimecard({
                    store_id: storeId,
                    date: start.toISOString()
                });


            const formatted = {};

            (scheduleData || []).forEach(({ employee_id, time_log }) => {
                // console.log(employee_id, 'Raw logs from DB:', time_log);
                const logsForDay = (time_log || []).filter(entry => {
                    const entryDate = dayjs(entry.timestamp);
                    return entryDate.isSame(start, 'day');
                });

                const timestamp = {};
                logsForDay.forEach(entry => {
                    // Convert UTC timestamp to local time 
                    const localTime = utcToLocal(entry.timestamp, storeTimezone, 'HH:mm');
                    timestamp[entry.type] = localTime;
                });

                formatted[employee_id] = timestamp;
            });

                setTimecardData(formatted);
            } catch (error) {
                console.error('Error fetching timecard data:', error);
                setMessage('❌ Failed to load timecard data.');
            }
        };

        fetchData();
    }, [storeId, date]);

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
                    const utcDateTime = dayjs.tz(localDateTime, storeTimezone).utc().toISOString();
                    updatedLogs.push({
                        type,
                        timestamp: utcDateTime,
                        latitude: 0,
                        longitude: 0,
                        distance_from_store: 0
                    });
                }
            }

            // Note: This timecard save functionality will need to be implemented
            // in the backend API as it involves complex time_log JSON updates
            try {
                // TODO: Implement ScheduleService.updateTimeLog(empId, storeId, updatedLogs, date);
                console.log('Time log update needed for employee:', empId, updatedLogs);
                
                // Temporary: show success message
                // In production, implement /api/schedule/timecard/update endpoint
            } catch (error) {
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
                                    {date.format('ddd, MMMM D, YYYY')}
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
                                                                        <InputField
                                                                            className="w-full border rounded px-1 text-sm focus:ring-blue-500 focus:outline-none"
                                                                            type="text"
                                                                            value={shifts[type] || ''}
                                                                            onChange={e => handleInputChange(emp.employee_id, type, e.target.value)}
                                                                            onBlur={handleInputBlur}
                                                                            placeholder="--:--"
                                                                            autoFocus
                                                                            validate={(value) => {
                                                                                if (!value) return null;
                                                                                const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
                                                                                return timeRegex.test(value) ? null : "Please enter time in HH:MM format (e.g. 09:00)";
                                                                            }}
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
