import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";

const MyStore = () => {
  const { isAuthenticated, user } = useAuth();
  const [store, setStore] = useState(null);
  const [team, setTeam] = useState([]);
  const [openTeam, setOpenTeam] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeSchedule, setEmployeeSchedule] = useState([]);

  useEffect(() => {
    const fetchStore = async () => {
      if (!user || user.role_id !== 3) return setLoading(false);

      const { data: empData, error: empError } = await supabase
        .from("employee")
        .select("store_id")
        .eq("email", user.email)
        .single();

      if (empError || !empData?.store_id) return setLoading(false);

      const { data: storeData } = await supabase
        .from("store")
        .select("store_id, store_name, city, province")
        .eq("store_id", empData.store_id)
        .single();

      const { data: teamData } = await supabase
        .from("employee")
        .select("employee_id, first_name, last_name, role_id")
        .eq("store_id", empData.store_id);

      setStore(storeData);
      setTeam(teamData);
      setLoading(false);
    };

    fetchStore();
  }, [user]);

  const fetchEmployeeSchedule = async (employeeId) => {
    const { data } = await supabase
      .from("store_schedule")
      .select("start_time, end_time")
      .eq("employee_id", employeeId)
      .order("start_time", { ascending: true });

    setEmployeeSchedule(data || []);
  };

  const openScheduleModal = async (employee) => {
    setSelectedEmployee(employee);
    await fetchEmployeeSchedule(employee.employee_id);
  };

  const closeModal = () => {
    setSelectedEmployee(null);
    setEmployeeSchedule([]);
  };

  const formatDateTime = (dateTimeStr) => {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(dateTimeStr).toLocaleString("en-US", options);
  };

  if (!isAuthenticated || user.role_id !== 3) {
    return <div className="p-6 text-center text-red-500">Access Denied</div>;
  }

  if (loading) {
    return <div className="p-6 text-center">Loading your store info...</div>;
  }

  return (
    <div className="max-w-full mx-auto p-6   rounded-xl">
      <h1 className="text-2xl font-bold  text-black mb-8">
        Revital Health - {store.store_name}
      </h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border">
        <h2 className="text-xl font-bold text-gray-800 mb-3">Store Overview</h2>
        <div className="space-y-2 text-gray-700 text-base">
          <p><span className="font-medium">Store ID:</span> {store.store_id}</p>
          <p><span className="font-medium">Team Size:</span> {team.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 border">
        <button
          onClick={() => setOpenTeam(!openTeam)}
          className="w-full text-left text-lg font-semibold text-blue-700 hover:text-blue-900 mb-4"
        >
          {openTeam ? "▼ Hide staff" : "▶ View staff"}
        </button>

        {openTeam && (
          <div className="border-t pt-4">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Current Team</h3>
            <ul className="space-y-2">
              {team.map((member, index) => (
                <li
                  key={index}
                  className="bg-gray-100 hover:bg-blue-50 p-3 rounded-md cursor-pointer shadow-sm transition"
                  onClick={() => openScheduleModal(member)}
                >
                  <span className="font-medium text-gray-900">{member.first_name} {member.last_name}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    ({member.role_id === 3 ? "Manager" : "Staff"})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">
              Schedule for {selectedEmployee.first_name} {selectedEmployee.last_name}
            </h2>
            {employeeSchedule.length > 0 ? (
              <ul className="text-sm space-y-2 max-h-60 overflow-y-auto">
                {employeeSchedule.map((shift, i) => (
                  <li key={i} className="text-gray-700 border-b pb-1">
                    <span className="block">
                      <span className="font-medium">Start:</span> {formatDateTime(shift.start_time)}
                    </span>
                    <span className="block">
                      <span className="font-medium">End:</span> {formatDateTime(shift.end_time)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No scheduled shifts found.</p>
            )}
            <button
              onClick={closeModal}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyStore;