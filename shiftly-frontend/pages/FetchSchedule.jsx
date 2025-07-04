import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

import WeeklyCalendar from "../components/WeeklyCalendar";

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
  const [employeeId, setEmployeeId] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [tab, setTab] = useState("schedule");

  const [selectedWeek, setSelectedWeek] = useState([]);
  const [weekStartDate, setWeekStartDate] = useState(null);
  const [weekEndDate, setWeekEndDate] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchShifts = async () => {

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: employee } = await supabase
        .from("employee")
        .select("employee_id")
        .eq("email", user.email)
        .single();

      if (!employee) return;

      setEmployeeId(employee.employee_id);

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
    const shiftDate = new Date(shift.start_time);
    return (
      weekStartDate &&
      weekEndDate &&
      shiftDate >= weekStartDate &&
      shiftDate <= weekEndDate
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 pt-8 items-start">

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 w-full md:w-1/3 max-w-xs flex flex-col min-h-[320px]">
          <h2 className="text-lg font-semibold mb-2">Select Week</h2>
          <WeeklyCalendar onWeekSelect={handleWeekSelect} />
        </div>

        <div className="flex-1 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
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
            <button
              onClick={() => navigate("/change-availability")}
              className="bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-blue-800 transition mt-4 sm:mt-0"
            >
              Change Availability
            </button>
          </div>

          {tab === "schedule" ? (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">

              <div className="text-lg font-semibold mb-4">
                {weekStartDate && weekEndDate
                  ? `${weekStartDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${weekEndDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                  : "Select a week"}

              </div>
              {weekShiftData.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No shifts scheduled for this week.</div>
              ) : (
                weekShiftData.map((shift, idx) => {
                  const start = new Date(shift.start_time);
                  const end = new Date(shift.end_time);
                  const timeLabel = `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}`;
                  const { label, color } = getShiftTypeAndColor(shift.start_time, shift.end_time);
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
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">My Availability</h2>
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
                      <td className="p-2 border">
                        {availability[idx]?.start_time
                          ? new Date(availability[idx].start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "-"}
                      </td>
                      <td className="p-2 border">
                        {availability[idx]?.end_time
                          ? new Date(availability[idx].end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
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
  );
};

export default FetchSchedule;