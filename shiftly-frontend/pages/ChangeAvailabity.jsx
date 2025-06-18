import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

const ChangeAvailabity = () => {
  const [employeeId, setEmployeeId] = useState(null);
  const [mode, setMode] = useState("general"); // 'general' or 'specific'
  // General availability: array of 7 objects { day, start, end }
  const [generalAvailability, setGeneralAvailability] = useState(
    daysOfWeek.map(day => ({ day, start: "", end: "" }))
  );
  // Specific date availability
  const [specificDate, setSpecificDate] = useState("");
  const [specificStart, setSpecificStart] = useState("");
  const [specificEnd, setSpecificEnd] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEmployeeId = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;
      const { data: employee, error: empError } = await supabase
        .from("employee")
        .select("employee_id")
        .eq("email", user.email)
        .single();
      if (!empError && employee) setEmployeeId(employee.employee_id);
    };
    fetchEmployeeId();
  }, []);

  const handleGeneralChange = (idx, field, value) => {
    setGeneralAvailability(prev =>
      prev.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      )
    );
  };

  const getNextDateForDay = (day) => {
    // day: 'Sunday'...'Saturday'
    const today = new Date();
    const dayIndex = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].indexOf(day);
    const diff = (dayIndex + 7 - today.getDay()) % 7;
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + diff + 1); // always next week
    nextDate.setHours(0,0,0,0);
    return nextDate;
  };

  const handleGeneralSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    for (let i = 0; i < generalAvailability.length; i++) {
      const { start, end } = generalAvailability[i];
      if ((start && !end) || (!start && end)) {
        setError("Please fill both start and end times for all selected days.");
        return;
      }
    }
    const requestPayload = generalAvailability
      .filter(({ start, end }) => start && end)
      .map(({ day, start, end }) => ({ day, start, end }));
    if (requestPayload.length === 0) {
      setError("Please enter at least one day's availability.");
      return;
    }
    try {
      const { error: insertError } = await supabase
        .from("employee_request")
        .insert([
          {
            employee_id: employeeId,
            request_type: "availability",
            request: requestPayload,
            status: "Pending"
          }
        ]);
      if (insertError) {
        setError("Failed to submit availability request: " + insertError.message);
      } else {
        setSuccessMsg("Availability request submitted for approval.");
        setGeneralAvailability(daysOfWeek.map(day => ({ day, start: "", end: "" })));
      }
    } catch (err) {
      setError("An error occurred while submitting.");
    }
  };

  const handleSpecificSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    if (!specificDate || !specificStart || !specificEnd) {
      setError("Please fill all fields for specific date availability.");
      return;
    }
    try {
      const startDateTime = `${specificDate}T${specificStart}`;
      const endDateTime = `${specificDate}T${specificEnd}`;
      const { error: insertError } = await supabase
        .from("employee_availability_requests")
        .insert([
          {
            employee_id: employeeId,
            start_time: startDateTime,
            end_time: endDateTime,
            status: "pending",
            type: "specific"
          }
        ]);
      if (insertError) {
        setError("Failed to submit specific date availability request.");
      } else {
        setSuccessMsg("Specific date availability request submitted for approval.");
        setSpecificDate("");
        setSpecificStart("");
        setSpecificEnd("");
      }
    } catch (err) {
      setError("An error occurred while submitting.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10">
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Change Availability</h1>
        <div className="flex justify-center gap-4 mb-6">
          <button
            className={`px-4 py-2 rounded-lg font-semibold transition border ${mode === "general" ? "bg-blue-700 text-white border-blue-700" : "bg-gray-100 text-gray-700 border-gray-300"}`}
            onClick={() => setMode("general")}
          >
            Change General Availability
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-semibold transition border ${mode === "specific" ? "bg-blue-700 text-white border-blue-700" : "bg-gray-100 text-gray-700 border-gray-300"}`}
            onClick={() => setMode("specific")}
          >
            Change for Specific Date
          </button>
        </div>
        {mode === "general" ? (
          <form onSubmit={handleGeneralSubmit} className="space-y-4">
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
                  {generalAvailability.map((item, idx) => (
                    <tr key={item.day}>
                      <td className="p-2 border font-medium">{item.day}</td>
                      <td className="p-2 border">
                        <input
                          type="time"
                          value={item.start}
                          onChange={e => handleGeneralChange(idx, "start", e.target.value)}
                          className="border p-1 rounded"
                        />
                      </td>
                      <td className="p-2 border">
                        <input
                          type="time"
                          value={item.end}
                          onChange={e => handleGeneralChange(idx, "end", e.target.value)}
                          className="border p-1 rounded"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="submit" className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 w-full mt-4">
              Submit General Availability
            </button>
          </form>
        ) : (
          <form onSubmit={handleSpecificSubmit} className="space-y-4">
            <div>
              <label className="block font-medium">Date</label>
              <input
                type="date"
                value={specificDate}
                onChange={e => setSpecificDate(e.target.value)}
                className="border p-2 w-full rounded"
                required
              />
            </div>
            <div>
              <label className="block font-medium">Start Time</label>
              <input
                type="time"
                value={specificStart}
                onChange={e => setSpecificStart(e.target.value)}
                className="border p-2 w-full rounded"
                required
              />
            </div>
            <div>
              <label className="block font-medium">End Time</label>
              <input
                type="time"
                value={specificEnd}
                onChange={e => setSpecificEnd(e.target.value)}
                className="border p-2 w-full rounded"
                required
              />
            </div>
            <button type="submit" className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 w-full">
              Submit Specific Date Availability
            </button>
          </form>
        )}
        {successMsg && <p className="mt-4 text-green-600 text-center">{successMsg}</p>}
        {error && <p className="mt-4 text-red-600 text-center">{error}</p>}
      </div>
    </div>
  );
};

export default ChangeAvailabity;
