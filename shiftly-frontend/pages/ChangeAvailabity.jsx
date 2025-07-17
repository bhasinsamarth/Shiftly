import React, { useState } from "react";
import CalendarWidget from "../components/CalendarWidget";
import { supabase } from "../supabaseClient";
import { submitEmployeeRequest } from "../utils/requestHandler";

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

function getMonthYear(date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
  };
}

const AvailabilityTable = ({ availability, onChange }) => (
  <div className="bg-white rounded-lg shadow overflow-hidden">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {WEEKDAYS.map((day) => (
          <tr key={day}>
            <td className="px-6 py-4 whitespace-nowrap font-medium">{day}</td>
            <td className="px-6 py-4">
              {availability[day]?.start_time ? (
                <span>{formatToLocalDateTime(availability[day].start_time)}</span>
              ) : (
                <input
                  type="time"
                  value={availability[day]?.start || ""}
                  onChange={(e) => onChange(day, "start", e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 w-full"
                />
              )}
            </td>
            <td className="px-6 py-4">
              {availability[day]?.end_time ? (
                <span>{formatToLocalDateTime(availability[day].end_time)}</span>
              ) : (
                <input
                  type="time"
                  value={availability[day]?.end || ""}
                  onChange={(e) => onChange(day, "end", e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 w-full"
                />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

function parseLocalDate(str) {
  const [year, month, day] = str.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// ✅ Combines a date and time into a UTC ISO string
function combineDateAndTimeAsLocalISOString(dateObj, timeStr) {
  const [hour, minute] = timeStr.split(":").map(Number);
  const local = new Date(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate(),
    hour,
    minute,
    0,
    0
  );
  return local.toISOString();
}

// ✅ Formats UTC string to readable local time
export function formatToLocalDateTime(utcString) {
  if (!utcString) return "-";
  const date = new Date(utcString);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

const ChangeAvailability = () => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const today = new Date();
  const [{ year, month }, setMonthYear] = useState(getMonthYear(today));

  const [availability, setAvailability] = useState(() => {
    const initial = {};
    WEEKDAYS.forEach((day) => {
      initial[day] = { start: "09:00", end: "17:00" };
    });
    return initial;
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selecting, setSelecting] = useState(null);
  const [employeeId, setEmployeeId] = useState(null);

  React.useEffect(() => {
    async function fetchEmployeeId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: employee } = await supabase
          .from("employee")
          .select("employee_id")
          .eq("email", user.email)
          .single();
        if (employee) setEmployeeId(employee.employee_id);
      }
    }
    fetchEmployeeId();
  }, []);

  const highlightedDates = React.useMemo(() => {
    if (!startDate || !endDate) return [];
    const arr = [];
    let d = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    while (d <= end) {
      arr.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return arr;
  }, [startDate, endDate]);

  const handleDateClick = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const localDateStr = `${yyyy}-${mm}-${dd}`;
    if (selecting === "start") {
      setStartDate(localDateStr);
      setSelecting(null);
    } else if (selecting === "end") {
      setEndDate(localDateStr);
      setSelecting(null);
    }
  };

  const isDateValid = startDate && endDate && startDate <= endDate;
  const isValidTimeForAllDays = Object.values(availability).every(
    ({ start, end }) => start && end && start < end
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isDateValid) {
      setError("End date must be after start date.");
      setSuccess("");
      return;
    }
    if (!isValidTimeForAllDays) {
      setError("Start time must be before end time for each day.");
      setSuccess("");
      return;
    }
    if (!employeeId) {
      setError("Employee not found.");
      setSuccess("");
      return;
    }

    const combinedAvailability = {};
    let d = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    while (d <= end) {
      const dayName = WEEKDAYS[d.getDay()];
      const { start, end: endTime } = availability[dayName];
      const startISO = combineDateAndTimeAsLocalISOString(d, start);
      const endISO = combineDateAndTimeAsLocalISOString(d, endTime);
      console.log(`${dayName}: ${startISO} to ${endISO}`);
      combinedAvailability[dayName] = {
        start_time: startISO,
        end_time: endISO,
      };
      d.setDate(d.getDate() + 1);
    }

    const requestPayload = {
      employee_id: employeeId,
      request_type: "availability",
      request: {
        start_date: startDate,
        end_date: endDate,
        preferred_hours: combinedAvailability
      }
    };

    const result = await submitEmployeeRequest(requestPayload);
    if (!result.success) {
      setError("Failed to submit request: " + result.error);
      setSuccess("");
    } else {
      setError("");
      setSuccess("Availability request submitted for approval!");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex p-8 space-x-8">
      {/* Calendar Section */}
      <div className="w-80 bg-white p-6 rounded-xl shadow flex flex-col items-center">
        <h2 className="text-xl font-semibold mb-4">Select Date Range</h2>
        <div className="flex gap-2 mb-4">
          <button
            className={`px-3 py-1 rounded ${selecting === "start" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
            onClick={() => setSelecting("start")}
          >
            Pick Start
          </button>
          <button
            className={`px-3 py-1 rounded ${selecting === "end" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
            onClick={() => setSelecting("end")}
          >
            Pick End
          </button>
        </div>
        <CalendarWidget
          year={year}
          month={month}
          highlightedDates={highlightedDates}
          selectedDate={null}
          onDateClick={handleDateClick}
        />
        <div className="flex gap-2 mt-4 w-full">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm"
            />
          </div>
        </div>
      </div>
      {/* Form Section */}
      <div className="flex-1 bg-white p-6 rounded-xl shadow">
        <h1 className="text-3xl font-bold mb-6">Set Your Availability</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Daily Availability</h2>
            <AvailabilityTable
              availability={availability}
              onChange={(day, field, value) =>
                setAvailability({
                  ...availability,
                  [day]: { ...availability[day], [field]: value }
                })
              }
            />
          </div>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          {success && <p className="text-green-500 mb-4">{success}</p>}
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Save Availability
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangeAvailability;
