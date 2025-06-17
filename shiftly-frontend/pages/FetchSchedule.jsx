import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const FetchSchedule = () => {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [employeeId, setEmployeeId] = useState(null);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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
          .select("id")
          .eq("email", user.email)
          .single();

        if (empError || !employee) {
          setError("Could not fetch employee record.");
          setLoading(false);
          return;
        }

        setEmployeeId(employee.id);

        const { data: shiftData, error: shiftError } = await supabase
          .from("schedules")
          .select("*")
          .eq("employee_id", employee.id)
          .order("shift_start", { ascending: true });

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
        status: "pending"  // Optional: depends on your schema
      };

      const { error: insertError } = await supabase
        .from("employee_availability_requests") // Make sure this table exists
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
    <div className="container mx-auto p-4 sm:p-8">
      {/* Schedule Section */}
      <section className="mb-6 bg-blue-700 rounded-xl px-6 py-5">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">My Schedule</h1>
        <p className="text-blue-100">View your upcoming shifts below.</p>
      </section>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
        {loading ? (
          <div className="text-center text-blue-700 font-semibold">Loading schedule...</div>
        ) : error ? (
          <div className="text-center text-red-600">{error}</div>
        ) : shifts.length === 0 ? (
          <div className="text-center text-gray-500">No shifts scheduled.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">Start</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">End</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {shifts.map((shift) => (
                  <tr key={shift.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                      {shift.shift_start ? new Date(shift.shift_start).toLocaleDateString() : "--"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                      {shift.shift_start ? new Date(shift.shift_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                      {shift.shift_end ? new Date(shift.shift_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                      {shift.department || "--"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                      {shift.location || "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Availability Form */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Submit Availability Change</h2>
        <form onSubmit={handleAvailabilitySubmit} className="space-y-4">
          <div>
            <label className="block font-medium">Start Time</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="border p-2 w-full rounded"
              required
            />
          </div>
          <div>
            <label className="block font-medium">End Time</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="border p-2 w-full rounded"
              required
            />
          </div>
          <button type="submit" className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800">
            Submit Request
          </button>
        </form>

        {successMsg && <p className="mt-4 text-green-600">{successMsg}</p>}
        {error && <p className="mt-4 text-red-600">{error}</p>}
      </div>
    </div>
  );
};

export default FetchSchedule;
