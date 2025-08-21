import React, { useState } from "react";
import RangeCalendar from "../components/RangeCalendar";
import { supabase } from "../supabaseClient";
import { submitEmployeeRequest } from "../utils/requestHandler";
import {  localToUTC } from "../utils/timezoneUtils";

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

const AvailabilityTable = ({ availability, onChange, storeTimezone = "UTC" }) => (
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
              <input
                type="time"
                value={availability[day]?.start || ""}
                onChange={(e) => onChange(day, "start", e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 w-full"
              />
            </td>
            <td className="px-6 py-4">
              <input
                type="time"
                value={availability[day]?.end || ""}
                onChange={(e) => onChange(day, "end", e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 w-full"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

function combineDateAndTimeAsStoreISOString(dateObj, timeStr, storeTimezone = "UTC") {
  // Create a date string in YYYY-MM-DD format
  const dateStr = dateObj.toISOString().split('T')[0];
  // Combine date and time as local time in store timezone
  const localDateTime = `${dateStr}T${timeStr}:00`;
  // Convert from store local time to UTC
  return localToUTC(localDateTime, storeTimezone);
}

const ChangeAvailability = () => {
  const [range, setRange] = useState({ start: null, end: null });
  const [availability, setAvailability] = useState(() => {
    const initial = {};
    WEEKDAYS.forEach((day) => {
      initial[day] = { start: "09:00", end: "17:00" };
    });
    return initial;
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [employeeId, setEmployeeId] = useState(null);
  const [storeTimezone, setStoreTimezone] = useState("UTC");

  React.useEffect(() => {
    async function fetchEmployeeData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: employee } = await supabase
          .from("employee")
          .select("employee_id, store_id")
          .eq("email", user.email)
          .single();
        
        if (employee) {
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
        }
      }
    }
    fetchEmployeeData();
  }, []);

  const isDateValid = range.start && range.end && range.start <= range.end;
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
    let d = new Date(range.start);
    const end = new Date(range.end);
    while (d <= end) {
      const dayName = WEEKDAYS[d.getDay()];
      const { start, end: endTime } = availability[dayName];
      const startISO = combineDateAndTimeAsStoreISOString(d, start, storeTimezone);
      const endISO = combineDateAndTimeAsStoreISOString(d, endTime, storeTimezone);
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
        start_date: range.start ? range.start.toISOString().split('T')[0] : "",
        end_date: range.end ? range.end.toISOString().split('T')[0] : "",
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
    <div className="flex flex-col md:flex-row w-full">
      {/* Calendar Section */}
      <div className=" flex flex-col items-center justify-center bg-white-50 p-4 sm:p-6 md:p-8 border-b md:border-b-0 md:border-r min-h-[420px]">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-center">Select Date Range</h3>
        <div className="w-full flex justify-center mb-4">
          <RangeCalendar
            selectedRange={range}
            onRangeSelect={setRange}
          />
        </div>
        <button
          type="button"
          className="px-3 py-1 rounded text-xs font-semibold border bg-gray-200 text-gray-700 mt-2"
          onClick={() => setRange({ start: null, end: null })}
        >
          Clear Selection
        </button>
        <div className="flex gap-2 mt-4 w-full">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1">Start Date</label>
            <input
              type="text"
              value={range.start ? range.start.toLocaleDateString() : ''}
              readOnly
              className="w-full border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1">End Date</label>
            <input
              type="text"
              value={range.end ? range.end.toLocaleDateString() : ''}
              readOnly
              className="w-full border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"
            />
          </div>
        </div>
      </div>
      {/* Form Section */}
      <div className="md:w-1/2 w-full p-4 sm:p-6 flex flex-col justify-center">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-center">Set Your Availability</h2>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Daily Availability</h3>
            <AvailabilityTable
              availability={availability}
              storeTimezone={storeTimezone}
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition"
          >
            Save Availability
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangeAvailability;