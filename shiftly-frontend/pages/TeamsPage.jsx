// TeamsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";

// VIcon Component: A custom dropdown indicator.
const VIcon = ({ open }) => {
  return (
    <div
      style={{
        width: "16px",
        height: "16px",
        display: "inline-block",
        transition: "transform 0.2s ease-in-out",
        transform: open ? "rotate(0deg)" : "rotate(180deg)",
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "0%",
            width: "2px",
            height: "70%",
            backgroundColor: "currentColor",
            transform: "translateX(-50%) rotate(45deg)",
            transformOrigin: "top center",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "0%",
            width: "2px",
            height: "70%",
            backgroundColor: "currentColor",
            transform: "translateX(-50%) rotate(-45deg)",
            transformOrigin: "top center",
          }}
        />
      </div>
    </div>
  );
};

const TeamsPage = () => {
  const { isAuthenticated, isAdmin } = useAuth();

  // Main teams list state
  const [teamsData, setTeamsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openTeams, setOpenTeams] = useState({});

  // Notification state for messages displayed on the website.
  const [notification, setNotification] = useState({ message: "", type: "" });

  // -------------------------
  // Add Team Modal States
  // -------------------------
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  // -------------------------
  // Edit Team Modal States
  // -------------------------
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTeamName, setEditTeamName] = useState("");
  const [editSelectedEmployeeIds, setEditSelectedEmployeeIds] = useState(new Set());

  // -------------------------
  // Delete Confirmation Modal State
  // -------------------------
  const [teamToDelete, setTeamToDelete] = useState(null);

  // -------------------------
  // Fetch teams data (without created_at)
  // -------------------------
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const { data, error } = await supabase
          .from("teams")
          .select("employee_id, employee_name, team")
          .order("team", { ascending: true });
        if (error) {
          console.error("Error fetching teams:", error);
          setError("Failed to load teams data.");
        } else {
          setTeamsData(data || []);
          // Group teams by team name.
          const groups = {};
          (data || []).forEach((row) => {
            if (!groups[row.team]) {
              groups[row.team] = [];
            }
            groups[row.team].push(row);
          });
          // Initialize open/closed state for each group.
          const initialOpenState = {};
          Object.keys(groups).forEach((teamName) => {
            initialOpenState[teamName] = false;
          });
          setOpenTeams(initialOpenState);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setError("Something went wrong while fetching teams.");
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchTeams();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Group teamsData by team name for display.
  const groupedTeams = teamsData.reduce((acc, row) => {
    if (!acc[row.team]) {
      acc[row.team] = [];
    }
    acc[row.team].push(row);
    return acc;
  }, {});

  const toggleTeamGroup = (teamLabel) => {
    setOpenTeams((prev) => ({
      ...prev,
      [teamLabel]: !prev[teamLabel],
    }));
  };

  // -------------------------
  // Notification helper
  // -------------------------
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: "", type: "" }), 3000);
  };

  // -------------------------
  // Common Function: Fetch employees from "employees" table
  // -------------------------
  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) {
        console.error("Error fetching employees:", error);
        showNotification("Failed to load employees.", "error");
        return;
      }
      setEmployees(data || []);
    } catch (err) {
      console.error("Unexpected error fetching employees:", err);
      showNotification("Unexpected error loading employees.", "error");
    }
  };

  // -------------------------
  // ADD TEAM Functions
  // -------------------------
  const handleAddTeam = async () => {
    if (!isAdmin) return;
    setNewTeamName("");
    setSearchTerm("");
    setSelectedEmployeeIds(new Set());
    await fetchEmployees();
    setShowAddModal(true);
  };

  const handleToggleEmployee = (employeeId) => {
    setSelectedEmployeeIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmitAddTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName) {
      showNotification("Please provide a team name.", "error");
      return;
    }
    if (selectedEmployeeIds.size === 0) {
      showNotification("Please select at least one employee.", "error");
      return;
    }
    // Build rows for each selected employee.
    const rowsToInsert = [];
    employees.forEach((emp) => {
      if (selectedEmployeeIds.has(emp.id)) {
        rowsToInsert.push({
          team: newTeamName,
          employee_id: emp.id,
          employee_name: emp.name,
        });
      }
    });
    try {
      const { data, error } = await supabase.from("teams").insert(rowsToInsert);
      if (error) {
        console.error("Error adding team members:", error);
        showNotification("Failed to add new team members.", "error");
      } else {
        setTeamsData((prev) => [...prev, ...data]);
        setShowAddModal(false);
        showNotification("Team created successfully.", "success");
      }
    } catch (err) {
      console.error("Unexpected error adding team:", err);
      showNotification("Unexpected error occurred while adding the team.", "error");
    }
  };

  // -------------------------
  // EDIT TEAM Functions
  // -------------------------
  const handleEditTeam = async (e, teamLabel) => {
    e.stopPropagation();
    if (!isAdmin) return;
    // Open the edit modal and pre-populate selections based on current team members.
    setEditTeamName(teamLabel);
    // From the grouped teams, get the current members' ids.
    const currentMembers = groupedTeams[teamLabel] || [];
    const currentMemberIds = new Set(currentMembers.map((mem) => mem.employee_id));
    setEditSelectedEmployeeIds(currentMemberIds);
    // (Re)load employee list.
    await fetchEmployees();
    setShowEditModal(true);
  };

  const handleToggleEditEmployee = (employeeId) => {
    setEditSelectedEmployeeIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  const filteredEditEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmitEditTeam = async (e) => {
    e.preventDefault();
    if (!editTeamName) {
      showNotification("Team name is missing.", "error");
      return;
    }
    // Determine current members (from groupedTeams) and new selections.
    const currentMembers = groupedTeams[editTeamName] || [];
    const currentMemberIds = new Set(currentMembers.map((mem) => mem.employee_id));
    const newMemberIds = editSelectedEmployeeIds;

    // Calculate which employees to add and which to remove.
    const toAdd = [];
    employees.forEach((emp) => {
      if (newMemberIds.has(emp.id) && !currentMemberIds.has(emp.id)) {
        toAdd.push({
          team: editTeamName,
          employee_id: emp.id,
          employee_name: emp.name,
        });
      }
    });
    const toRemove = [];
    currentMembers.forEach((mem) => {
      if (!newMemberIds.has(mem.employee_id)) {
        toRemove.push(mem.employee_id);
      }
    });
    try {
      // Perform deletion of removed employees
      if (toRemove.length > 0) {
        const { error: delError } = await supabase
          .from("teams")
          .delete()
          .eq("team", editTeamName)
          .in("employee_id", toRemove);
        if (delError) {
          console.error("Error removing team members:", delError);
          showNotification("Failed to remove some team members.", "error");
          return;
        }
      }
      // Insert new rows
      if (toAdd.length > 0) {
        const { error: insError } = await supabase.from("teams").insert(toAdd);
        if (insError) {
          console.error("Error adding new team members:", insError);
          showNotification("Failed to add new team members.", "error");
          return;
        }
      }
      // Refresh teams data
      const { data, error: fetchError } = await supabase
        .from("teams")
        .select("employee_id, employee_name, team")
        .order("team", { ascending: true });
      if (fetchError) {
        console.error("Error refreshing teams:", fetchError);
      } else {
        setTeamsData(data || []);
        showNotification("Team updated successfully.", "success");
      }
      setShowEditModal(false);
    } catch (err) {
      console.error("Unexpected error editing team:", err);
      showNotification("Unexpected error occurred while updating the team.", "error");
    }
  };

  // -------------------------
  // DELETE TEAM Functions (using custom modal)
  // -------------------------
  const handleDeleteTeamClick = (e, teamLabel) => {
    e.stopPropagation();
    if (!isAdmin) return;
    setTeamToDelete(teamLabel);
  };

  const confirmDeleteTeam = async () => {
    if (!teamToDelete) return;
    try {
      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("team", teamToDelete);
      if (error) {
        console.error("Error deleting team:", error);
        showNotification("Failed to delete team.", "error");
      } else {
        setTeamsData((prev) => prev.filter((row) => row.team !== teamToDelete));
        showNotification(`Team '${teamToDelete}' deleted successfully.`, "success");
      }
    } catch (err) {
      console.error("Unexpected delete error:", err);
      showNotification("Unexpected error occurred while deleting the team.", "error");
    } finally {
      setTeamToDelete(null);
    }
  };

  const cancelDeleteTeam = () => {
    setTeamToDelete(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="p-4 text-center text-red-500">Access Denied</div>
    );
  }
  if (loading) {
    return <div className="p-4">Loading teams...</div>;
  }
  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-8 bg-gray-50 min-h-screen">
      {/* Notification Banner */}
      {notification.message && (
        <div className={`mb-6 p-4 rounded ${notification.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {notification.message}
        </div>
      )}
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-10">
        <h1 className="text-4xl font-bold text-gray-800 mb-4 sm:mb-0">
          Teams
        </h1>
        {isAdmin && (
          <button
            onClick={handleAddTeam}
            className="px-6 py-3 bg-green-600 text-white rounded shadow hover:bg-green-700 transition-all"
          >
            Add Team
          </button>
        )}
      </div>
      {/* Teams listing */}
      {Object.keys(groupedTeams).length === 0 ? (
        <p className="text-gray-700 text-lg">No teams found.</p>
      ) : (
        Object.keys(groupedTeams)
          .sort()
          .map((teamLabel) => (
            <div
              key={teamLabel}
              className="mb-6 bg-white p-6 rounded-lg shadow hover:shadow-xl transition-shadow cursor-pointer border border-gray-200"
              onClick={() => toggleTeamGroup(teamLabel)}
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-gray-800">
                  {teamLabel}
                </h2>
                <div className="flex items-center space-x-4">
                  {isAdmin && (
                    <>
                      <button
                        onClick={(e) => handleEditTeam(e, teamLabel)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDeleteTeamClick(e, teamLabel)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  <VIcon open={openTeams[teamLabel]} />
                </div>
              </div>
              {openTeams[teamLabel] && (
                <div className="mt-4 border-t pt-4">
                  <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    {groupedTeams[teamLabel].map((member) => (
                      <li key={member.employee_id}>
                        {member.employee_name} (ID: {member.employee_id})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))
      )}
      {/* Add Team Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-96 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Add New Team</h2>
            <form onSubmit={handleSubmitAddTeam}>
              {/* Team Name Field */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Team Name
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  placeholder="e.g., 'Sales Team A'"
                  required
                />
              </div>
              {/* Employee Search */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Search Employee
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  placeholder="Type to filter employees..."
                />
              </div>
              {/* Employee List with Checkboxes */}
              <div className="border rounded p-3 max-h-60 overflow-y-auto mt-2">
                {filteredEmployees.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No matching employees found.
                  </p>
                ) : (
                  filteredEmployees.map((emp) => (
                    <div key={emp.id} className="flex items-center mb-2">
                      <input
                        id={`emp-${emp.id}`}
                        type="checkbox"
                        checked={selectedEmployeeIds.has(emp.id)}
                        onChange={() => handleToggleEmployee(emp.id)}
                        className="mr-2"
                      />
                      <label
                        htmlFor={`emp-${emp.id}`}
                        className="text-gray-700 cursor-pointer"
                      >
                        {emp.name} (ID: {emp.id})
                      </label>
                    </div>
                  ))
                )}
              </div>
              {/* Form Buttons */}
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                >
                  Add Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Team Modal */}
      {showEditModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-96 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Edit Team: {editTeamName}</h2>
            <form onSubmit={handleSubmitEditTeam}>
              {/* Reuse search field for filtering, if desired */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Search Employee
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  placeholder="Type to filter employees..."
                />
              </div>
              {/* Employee List with Checkboxes for Edit */}
              <div className="border rounded p-3 max-h-60 overflow-y-auto mt-2">
                {filteredEditEmployees.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No matching employees found.
                  </p>
                ) : (
                  filteredEditEmployees.map((emp) => (
                    <div key={emp.id} className="flex items-center mb-2">
                      <input
                        id={`edit-emp-${emp.id}`}
                        type="checkbox"
                        checked={editSelectedEmployeeIds.has(emp.id)}
                        onChange={() => handleToggleEditEmployee(emp.id)}
                        className="mr-2"
                      />
                      <label
                        htmlFor={`edit-emp-${emp.id}`}
                        className="text-gray-700 cursor-pointer"
                      >
                        {emp.name} (ID: {emp.id})
                      </label>
                    </div>
                  ))
                )}
              </div>
              {/* Form Buttons */}
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {teamToDelete && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-80">
            <h2 className="text-2xl font-bold mb-6">Confirm Delete</h2>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete team <strong>{teamToDelete}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={cancelDeleteTeam}
                className="px-5 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteTeam}
                className="px-5 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsPage;
