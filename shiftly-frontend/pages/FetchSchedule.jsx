import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { utcToLocal } from "../utils/timezoneUtils";

import WeeklyCalendar from "../components/WeeklyCalendar";

function getShiftTypeAndColor(start, end, timezone = 'America/Toronto') {
  if (!start || !end) return { label: "Unknown", color: "bg-gray-400" };

  // Convert UTC times to local timezone for classification
  const localStart = utcToLocal(start, timezone, 'HH');
  const localEnd = utcToLocal(end, timezone, 'HH');

  const startHour = parseInt(localStart);
  const endHour = parseInt(localEnd);

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
  const [employeeId, setEmployeeId] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [tab, setTab] = useState("schedule");
  const [storeTimezone, setStoreTimezone] = useState('America/Toronto'); // Default fallback

  const [selectedWeek, setSelectedWeek] = useState([]);
  const [weekStartDate, setWeekStartDate] = useState(null);
  const [weekEndDate, setWeekEndDate] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchShifts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get employee data including store association
      const { data: employee } = await supabase
        .from("employee")
        .select(`
          employee_id,
          store_id,
          store:store_id(timezone)
        `)
        .eq("email", user.email)
        .single();

      if (!employee) return;

      setEmployeeId(employee.employee_id);

      // Set store timezone from database
      if (employee.store?.timezone) {
        setStoreTimezone(employee.store.timezone);
      }

      // Fetch shifts
      const { data: shiftData } = await supabase
        .from("store_schedule")
        .select("*")
        .eq("employee_id", employee.employee_id)
        .order("start_time", { ascending: true });

      setShifts(shiftData || []);
    };

    fetchShifts();
  }, []);

  useEffect(() => {

    if (!employeeId) return;

    const fetchAvailability = async () => {
      const { data } = await supabase
        .from("employee_availability")
        .select("start_time, end_time")
        .eq("employee_id", employeeId);

      if (data) {

        const byDay = Array(7).fill(null);
        data.forEach(row => {
          const d = new Date(row.start_time);
          byDay[d.getDay()] = row;
        });
        setAvailability(byDay);
      }
    };


    fetchAvailability();
  }, [employeeId]);

  // Initialize to current week
  useEffect(() => {
    const today = new Date();
    handleWeekSelect(today);
  }, []);

  const handleWeekSelect = (clickedDate) => {
    if (!clickedDate) return;

    const sunday = new Date(clickedDate);
    sunday.setDate(clickedDate.getDate() - clickedDate.getDay());
    sunday.setHours(0, 0, 0, 0);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + i);
      week.push(day);

    }

    setSelectedWeek(week);
    setWeekStartDate(week[0]);
    setWeekEndDate(week[6]);
  };

  const weekShiftData = shifts.filter(shift => {
    if (!weekStartDate || !weekEndDate) return false;

    // Convert UTC shift time to store's local timezone for date comparison
    const shiftLocalDate = utcToLocal(shift.start_time, storeTimezone, 'yyyy-MM-dd');
    const shiftDate = new Date(shiftLocalDate + 'T00:00:00');

    // Create date-only versions for comparison
    const weekStart = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate());
    const weekEnd = new Date(weekEndDate.getFullYear(), weekEndDate.getMonth(), weekEndDate.getDate());

    return shiftDate >= weekStart && shiftDate <= weekEnd;
  });

  return (
    <div className="lg:ml-[16.67%] min-h-screen bg-white" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
      <div className="layout-container flex h-full grow flex-col">
        <div className="gap-1 pr-6 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col w-80">
            <h2 className="text-2xl font-bold leading-tight px-4 pb-3 pt-5">Schedule</h2>
            <div className="flex flex-wrap items-center justify-center gap-6 p-4">
              <div className="flex min-w-72 max-w-[336px] flex-1 flex-col gap-0.5">
                <WeeklyCalendar onWeekSelect={handleWeekSelect} />
              </div>
            </div>
          </div>
          <div className="layout-content-container flex flex-col flex-1 max-w-[960px]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 px-4 pt-5">
              <nav className="flex gap-6 font-medium">
                <span
                  className={`font-semibold text-md ${tab === "schedule" ? "border-b-2 border-blue-700 text-blue-700 pb-1 cursor-pointer" : "text-gray-500 cursor-pointer hover:text-blue-700"}`}
                  onClick={() => setTab("schedule")}
                >
                  My Schedule
                </span>
                <span
                  className={`font-semibold text-md ${tab === "availability" ? "border-b-2 border-blue-700 text-blue-700 pb-1 cursor-pointer" : "text-gray-500 cursor-pointer hover:text-blue-700"}`}
                  onClick={() => setTab("availability")}
                >
                  My Availability
                </span>
              </nav>
              <button
                onClick={() => navigate("/change-availability")}
                className="bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-blue-800 transition mt-4 sm:mt-0"
              >
                Change Availability
              </button>
            </div>
            {tab === "schedule" ? (
              <div className="bg-white rounded-xl shadow-md border border-[#dde1e3] p-6 mb-8">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-lg font-semibold">
                    {weekStartDate && weekEndDate
                      ? `${weekStartDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${weekEndDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                      : "Select a week"}
                  </div>
                  <div className="text-sm text-gray-500">
                    Times shown in: {storeTimezone.replace('_', ' ')}
                  </div>
                </div>
                {weekShiftData.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No shifts scheduled for this week.</div>
                ) : (
                  weekShiftData.map((shift, idx) => {
                    // Convert UTC times to store's local timezone for display
                    const localStartTime = utcToLocal(shift.start_time, storeTimezone, 'yyyy-MM-dd HH:mm');
                    const localEndTime = utcToLocal(shift.end_time, storeTimezone, 'yyyy-MM-dd HH:mm');

                    const start = new Date(localStartTime);
                    const end = new Date(localEndTime);

                    const timeLabel = `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}`;
                    const { label, color } = getShiftTypeAndColor(shift.start_time, shift.end_time, storeTimezone);

                    return (
                      <div key={shift.id || idx} className="flex items-center py-3 pl-8 pr-6 gap-6">
                        <span className="w-40 text-gray-700">
                          {start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                        <span className="w-40 text-gray-700">{timeLabel}</span>
                        <span className="text-xs text-gray-500">{shift.department || shift.location || ""}</span>
                        <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold shadow ${color}`}>
                          {label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md border border-[#dde1e3] p-6 mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">My Availability</h2>
                  <div className="text-sm text-gray-500">
                    Times shown in: {storeTimezone.replace('_', ' ')}
                  </div>
                </div>
                <table className="min-w-full border text-center">
                  <thead>
                    <tr>
                      <th className="p-2 border">Day</th>
                      <th className="p-2 border">Start Time</th>
                      <th className="p-2 border">End Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, idx) => (
                      <tr key={day}>
                        <td className="p-2 border font-medium">{day}</td>
                        <td className="p-2 border">
                          {availability[idx]?.start_time
                            ? utcToLocal(availability[idx].start_time, storeTimezone, 'HH:mm')
                            : "-"}
                        </td>
                        <td className="p-2 border">
                          {availability[idx]?.end_time
                            ? utcToLocal(availability[idx].end_time, storeTimezone, 'HH:mm')
                            : "-"}
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
    </div>
  );
};

export default FetchSchedule;