import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import CalendarWidget from '../components/CalendarWidget';

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekRange(date) {
  const d = new Date(date);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

// Helper to determine shift type and color
function getShiftTypeAndColor(start, end) {
  if (!start || !end) return { label: "Unknown", color: "bg-gray-400" };
  const startHour = new Date(start).getHours();
  const endHour = new Date(end).getHours();

  if (startHour >= 22 || endHour <= 6) {
    return { label: "Night Shift", color: "bg-purple-600 text-white" };
  } else if (startHour >= 15 && startHour < 22) {
    return { label: "Evening Shift", color: "bg-yellow-500 text-black" };
  } else if (startHour >= 6 && startHour < 15) {
    return { label: "Day Shift", color: "bg-blue-500 text-white" };
  }
  return { label: "Other", color: "bg-gray-400 text-white" };
}

export const FetchSchedule = () => {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [employeeId, setEmployeeId] = useState(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [availability, setAvailability] = useState([]);
  const [tab, setTab] = useState("schedule");
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, 1 = next week, -1 = previous week
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const navigate = useNavigate();

  useEffect(() => {
    const fetchShifts = async () => {
      setLoading(true);
      setError("");
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          setError("Could not fetch user info.");
          setLoading(false);
          return;
        }

        const { data: employee, error: empError } = await supabase
          .from("employee")
          .select("employee_id")
          .eq("email", user.email)
          .single();

        if (empError || !employee) {
          setError("Could not fetch employee record.");
          setLoading(false);
          return;
        }

        setEmployeeId(employee.employee_id);

        const { data: shiftData, error: shiftError } = await supabase
          .from("store_schedule")
          .select("*")
          .eq("employee_id", employee.employee_id)
          .order("start_time", { ascending: true });

        if (shiftError) {
          setError("Could not fetch schedule.");
        } else {
          setShifts(shiftData || []);
        }
      } catch (err) {
        setError("An unexpected error occurred.");
      }
      setLoading(false);
    };

    fetchShifts();
  }, []);

  useEffect(() => {
    const fetchAvailability = async (empId) => {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + 1); // next week
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("employee_availability")
        .select("start_time, end_time")
        .eq("employee_id", empId)
        .gte("start_time", startOfWeek.toISOString())
        .lte("start_time", endOfWeek.toISOString());

      if (!error && data) {
        const byDay = Array(7).fill(null);
        data.forEach(row => {
          const d = new Date(row.start_time);
          byDay[d.getDay()] = row;
        });
        setAvailability(byDay);
      }
    };

    if (employeeId) fetchAvailability(employeeId);
  }, [employeeId]);

  function getWeekKey(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }

  const allWeeks = {};
  shifts.forEach(shift => {
    const weekKey = getWeekKey(shift.start_time);
    if (!allWeeks[weekKey]) allWeeks[weekKey] = [];
    allWeeks[weekKey].push(shift);
  });

  const sortedWeekKeys = Object.keys(allWeeks).sort();

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - baseDate.getDay() + weekOffset * 7);
  baseDate.setHours(0, 0, 0, 0);
  const currentWeekKey = baseDate.toISOString().slice(0, 10);
  const weekShifts = allWeeks[currentWeekKey] || [];

  const weekStartDate = new Date(currentWeekKey);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayShift = shifts.find(s => s.start_time && new Date(s.start_time).toISOString().slice(0, 10) === todayStr);

  const handleAvailabilitySubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    if (!startTime || !endTime) {
      setError("Please fill both start and end times.");
      return;
    }

    try {
      const availabilityRequest = {
        employee_id: employeeId,
        start_time: startTime,
        end_time: endTime,
        status: "pending"
      };

      const { error: insertError } = await supabase
        .from("employee_availability_requests")
        .insert([availabilityRequest]);

      if (insertError) {
        setError("Failed to submit availability request.");
      } else {
        setSuccessMsg("Availability request submitted for approval.");
        setStartTime("");
        setEndTime("");
      }
    } catch (err) {
      setError("An error occurred while submitting.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 pt-8 items-start">
        {/* Calendar Sidebar */}
        <CalendarWidget
          selectedMonth={calendarMonth}
          onMonthChange={(newMonth) => setCalendarMonth(newMonth)}
          onDateSelect={(date) => {
            const selectedDate = new Date(date);

            // Get Sunday of selected week
            const selectedWeekStart = new Date(selectedDate);
            selectedWeekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
            selectedWeekStart.setHours(0, 0, 0, 0); // Normalize time

            // Get Sunday of current week
            const today = new Date();
            const currentWeekStart = new Date(today);
            currentWeekStart.setDate(today.getDate() - today.getDay());
            currentWeekStart.setHours(0, 0, 0, 0); // Normalize time

            // Calculate difference in weeks
            const diffInTime = selectedWeekStart.getTime() - currentWeekStart.getTime();
            const diffInWeeks = Math.round(diffInTime / (7 * 24 * 60 * 60 * 1000));

            setWeekOffset(diffInWeeks);
          }}
        />

        {/* Main Content */}
        <div className="flex-1 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="flex items-center gap-8">
              <nav className="flex gap-6 text-lg font-medium">
                <span
                  className={tab === "schedule" ? "border-b-2 border-blue-700 text-blue-700 pb-1 cursor-pointer" : "text-gray-500 cursor-pointer hover:text-blue-700"}
                  onClick={() => setTab("schedule")}
                >
                  My Schedule
                </span>
                <span
                  className={tab === "availability" ? "border-b-2 border-blue-700 text-blue-700 pb-1 cursor-pointer" : "text-gray-500 cursor-pointer hover:text-blue-700"}
                  onClick={() => setTab("availability")}
                >
                  My Availability
                </span>
              </nav>
            </div>
            <div className="flex gap-2 mt-4 sm:mt-0">
              <button
                onClick={() => navigate('/change-availability')}
                className="bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-blue-800 transition"
              >
                Change Availability
              </button>
            </div>
          </div>

          {tab === "schedule" ? (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg font-semibold">
                  {weekStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {weekEndDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <button
                  className="ml-4 px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm font-medium"
                  onClick={() => setWeekOffset(weekOffset - 1)}
                  disabled={weekOffset === 0}
                >
                  Previous Week
                </button>
                <button
                  className="ml-2 px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm font-medium"
                  onClick={() => setWeekOffset(weekOffset + 1)}
                >
                  Next Week
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {weekShifts.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No shifts scheduled for this week.</div>
                ) : (
                  weekShifts.map((shift, idx) => {
                    const dayLabel = shift.start_time ? new Date(shift.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '--';
                    const start = shift.start_time ? new Date(shift.start_time) : null;
                    const end = shift.end_time ? new Date(shift.end_time) : null;
                    const timeLabel = `${start ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--'} - ${end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--'}`;
                    const { label, color } = getShiftTypeAndColor(shift.start_time, shift.end_time);
                    return (
                      <div key={shift.id || idx} className="flex items-center py-3 pl-8 pr-6 gap-6">
                        <span className="w-40 text-gray-700">{dayLabel}</span>
                        <span className="inline-block w-40 text-gray-700">{timeLabel}</span>
                        <span className="text-xs text-gray-500 ml-2">{shift.department || shift.location || ''}</span>
                        <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold shadow ${color}`}>{label}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">My Availability</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border text-center">
                  <thead>
                    <tr>
                      <th className="p-2 border">Day</th>
                      <th className="p-2 border">Start Time</th>
                      <th className="p-2 border">End Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day, idx) => (
                      <tr key={day}>
                        <td className="p-2 border font-medium">{day}</td>
                        <td className="p-2 border">{availability[idx]?.start_time ? new Date(availability[idx].start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}</td>
                        <td className="p-2 border">{availability[idx]?.end_time ? new Date(availability[idx].end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FetchSchedule;