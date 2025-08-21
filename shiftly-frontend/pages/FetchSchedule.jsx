import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import WeeklyCalendar from "../components/WeeklyCalendar";
import { utcToLocal } from "../utils/timezoneUtils";

function getShiftTypeAndColor(start, end, timezone = 'America/Toronto') {
  if (!start || !end) return { label: "Unknown", color: "bg-gray-400" };
  
  // Convert to store timezone to get correct hours
  const startLocalTime = utcToLocal(start, timezone, "HH:mm");
  const endLocalTime = utcToLocal(end, timezone, "HH:mm");
  const startHour = parseInt(startLocalTime.split(':')[0]);
  const endHour = parseInt(endLocalTime.split(':')[0]);

  if (startHour >= 22 || endHour <= 6) {
    return { label: "Night Shift", color: "bg-purple-600 text-white" };
  } else if (startHour >= 15 && startHour < 22) {
    return { label: "Evening Shift", color: "bg-yellow-500 text-black" };
  } else if (startHour >= 6 && startHour < 15) {
    return { label: "Day Shift", color: "bg-blue-500 text-white" };
  }
  return { label: "Other", color: "bg-gray-400 text-white" };
}

const FetchSchedule = () => {
  const [shifts, setShifts] = useState([]);
  const [employeeId, setEmployeeId] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [tab, setTab] = useState("schedule");
  const [weekStartDate, setWeekStartDate] = useState(null);
  const [weekEndDate, setWeekEndDate] = useState(null);
  const [storeTimezone, setStoreTimezone] = useState("UTC");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchShifts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get employee data including store association
      const { data: employee } = await supabase
        .from("employee")
        .select("employee_id, store_id")
        .eq("email", user.email)
        .single();

      if (!employee) return;

      setEmployeeId(employee.employee_id);

      // Fetch store timezone
      if (employee.store_id) {
        const { data: store } = await supabase
          .from("store")
          .select("timezone")
          .eq("store_id", employee.store_id)
          .single();
        if (store?.timezone) setStoreTimezone(store.timezone);
      }

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
    <div className="min-h-screen bg-white-50">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-4 lg:gap-6 p-4 lg:pt-8 items-start">
        <div className="w-full lg:w-auto flex justify-center lg:justify-start">
          <WeeklyCalendar onWeekSelect={handleWeekSelect} />
        </div>

        <div className="flex-1 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 lg:mb-6 gap-4">
            <div className="flex items-center justify-between w-full sm:w-auto">
              <nav className="flex gap-4 lg:gap-6 text-base lg:text-lg font-medium">
                <span
                  className={tab === "schedule"
                    ? "border-b-2 border-blue-700 text-blue-700 pb-1 cursor-pointer"
                    : "text-gray-500 cursor-pointer hover:text-blue-700"}
                  onClick={() => setTab("schedule")}
                >
                  My Schedule
                </span>
                <span
                  className={tab === "availability"
                    ? "border-b-2 border-blue-700 text-blue-700 pb-1 cursor-pointer"
                    : "text-gray-500 cursor-pointer hover:text-blue-700"}
                  onClick={() => setTab("availability")}
                >
                  My Availability
                </span>
              </nav>
              
              {/* Mobile: Show ellipse icon with dropdown */}
              <div className="sm:hidden relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="inline-flex items-center text-gray-600 hover:text-blue-600 transition-colors p-2 rounded"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1"/>
                    <circle cx="12" cy="5" r="1"/>
                    <circle cx="12" cy="19" r="1"/>
                  </svg>
                </button>
                
                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                    <button
                      onClick={() => {
                        navigate("/change-availability");
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Change Availability
                    </button>
                  </div>
                )}
                
                {/* Click outside to close dropdown */}
                {isDropdownOpen && (
                  <div 
                    className="fixed inset-0 z-0" 
                    onClick={() => setIsDropdownOpen(false)}
                  />
                )}
              </div>
            </div>
            
            {/* Desktop: Show full button */}
            <button
              onClick={() => navigate("/change-availability")}
              className="hidden sm:flex bg-blue-700 text-white px-4 lg:px-5 py-2 rounded-lg font-semibold shadow hover:bg-blue-800 transition text-sm lg:text-base"
            >
              Change Availability
            </button>
          </div>

          {tab === "schedule" ? (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 lg:p-6 mb-6 lg:mb-8">
              <div className="text-base lg:text-lg font-semibold mb-4">
                {weekStartDate && weekEndDate
                  ? `${utcToLocal(weekStartDate.toISOString(), storeTimezone, "MMM dd")} - ${utcToLocal(weekEndDate.toISOString(), storeTimezone, "MMM dd")}`
                  : "Select a week"}
              </div>

              {weekShiftData.length === 0 ? (
                <div className="text-center text-gray-500 py-6 lg:py-8 text-sm lg:text-base">
                  No shifts scheduled for this week.
                </div>
              ) : (
                <div className="space-y-3">
                  {weekShiftData.map((shift, idx) => {
                    const timeLabel = `${utcToLocal(shift.start_time, storeTimezone, "hh:mm a")} - ${utcToLocal(shift.end_time, storeTimezone, "hh:mm a")}`;
                    const { label, color } = getShiftTypeAndColor(shift.start_time, shift.end_time, storeTimezone);
                    return (
                      <div key={shift.id || idx} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 lg:gap-6 py-3 px-4 lg:px-6 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-800 text-sm lg:text-base min-w-0 sm:w-32 lg:w-40">
                          {utcToLocal(shift.start_time, storeTimezone, "ccc, MMM dd")}
                        </span>
                        <span className="text-gray-700 text-sm lg:text-base min-w-0 sm:w-32 lg:w-40">
                          {timeLabel}
                        </span>
                        <span className="text-xs lg:text-sm text-gray-500 flex-1 min-w-0">
                          {shift.department || shift.location || ""}
                        </span>
                        <span className={`self-start sm:self-center px-3 py-1 rounded-full text-xs font-semibold shadow ${color} whitespace-nowrap`}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 lg:p-6 mb-6 lg:mb-8">
              <h2 className="text-lg lg:text-xl font-bold mb-4">My Availability</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border text-center text-sm lg:text-base">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 lg:p-3 border font-medium text-gray-700">Day</th>
                      <th className="p-2 lg:p-3 border font-medium text-gray-700">Start Time</th>
                      <th className="p-2 lg:p-3 border font-medium text-gray-700">End Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, idx) => (
                      <tr key={day} className="hover:bg-gray-50">
                        <td className="p-2 lg:p-3 border font-medium text-gray-800">{day}</td>
                        <td className="p-2 lg:p-3 border text-gray-700">
                          {availability[idx]?.start_time
                            ? utcToLocal(availability[idx].start_time, storeTimezone, "hh:mm a")
                            : "-"}
                        </td>
                        <td className="p-2 lg:p-3 border text-gray-700">
                          {availability[idx]?.end_time
                            ? utcToLocal(availability[idx].end_time, storeTimezone, "hh:mm a")
                            : "-"}
                        </td>
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