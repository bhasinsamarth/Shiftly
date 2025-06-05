// StoresPage.jsx
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

const StoresPage = () => {
  const { isAuthenticated, isAdmin } = useAuth();

  // Main stores list state
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openStores, setOpenStores] = useState({});

  // Notification state for messages displayed on the website.
  const [notification, setNotification] = useState({ message: "", type: "" });

  // -------------------------
  // Add Store Modal States (future functionality)
  // -------------------------
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreLocation, setNewStoreLocation] = useState("");

  // -------------------------
  // Edit Store Modal States (future functionality)
  // -------------------------
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStoreId, setEditStoreId] = useState(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editStoreLocation, setEditStoreLocation] = useState("");

  // -------------------------
  // Delete Confirmation Modal State
  // -------------------------
  const [storeToDelete, setStoreToDelete] = useState(null);

  // -------------------------
  // Fetch stores data
  // -------------------------
  // Move fetchStores outside useEffect so it can be called after add
  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("store")
        .select("store_id, store_name, location");
      if (error) {
        console.error("Error fetching stores:", error);
        setError("Failed to load stores data.");
      } else {
        setStores(data || []);
        // Initialize open/closed state for each store.
        const initialOpenState = {};
        (data || []).forEach((row) => {
          initialOpenState[row.store_id] = false;
        });
        setOpenStores(initialOpenState);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("Something went wrong while fetching stores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchStores();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch employee counts for each store
  useEffect(() => {
    async function fetchEmployeeCounts() {
      if (stores.length === 0) return;
      // Fetch all employees with their store_id
      const { data: employees, error } = await supabase
        .from('employee')
        .select('id, store_id');
      if (error) {
        console.error('Error fetching employees for store counts:', error);
        return;
      }
      // Count employees per store
      const counts = {};
      employees.forEach(emp => {
        if (emp.store_id) {
          counts[emp.store_id] = (counts[emp.store_id] || 0) + 1;
        }
      });
      // Attach employee_count to each store
      setStores(prev => prev.map(store => ({
        ...store,
        employee_count: counts[store.store_id] || 0
      })));
    }
    fetchEmployeeCounts();
  }, [stores.length]);

  const toggleStoreGroup = (storeId) => {
    setOpenStores((prev) => ({
      ...prev,
      [storeId]: !prev[storeId],
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
  // ADD STORE Functions (future functionality)
  // -------------------------
  const handleAddStore = async () => {
    if (!isAdmin) return;
    setNewStoreName("");
    setNewStoreLocation("");
    setShowAddModal(true);
  };

  const handleSubmitAddStore = async (e) => {
    e.preventDefault();
    if (!newStoreName) {
      showNotification("Please provide a store name.", "error");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("store")
        .insert([{ store_name: newStoreName, location: newStoreLocation }]);
      if (error) {
        console.error("Error adding store:", error);
        showNotification("Failed to add new store.", "error");
      } else {
        setShowAddModal(false);
        showNotification("Store added successfully.", "success");
        fetchStores(); // Refetch stores after successful add
      }
    } catch (err) {
      console.error("Unexpected error adding store:", err);
      showNotification("Unexpected error occurred while adding the store.", "error");
    }
  };

  // -------------------------
  // EDIT STORE Functions (future functionality)
  // -------------------------
  const handleEditStore = async (e, store) => {
    e.stopPropagation();
    if (!isAdmin) return;
    // Open the edit modal and pre-populate fields with current store data.
    setEditStoreId(store.store_id);
    setEditStoreName(store.store_name);
    setEditStoreLocation(store.location);
    setShowEditModal(true);
  };

  const handleSubmitEditStore = async (e) => {
    e.preventDefault();
    if (!editStoreName) {
      showNotification("Store name is missing.", "error");
      return;
    }
    try {
      const { error } = await supabase
        .from("store")
        .update({ store_name: editStoreName, location: editStoreLocation })
        .eq("store_id", editStoreId);
      if (error) {
        console.error("Error updating store:", error);
        showNotification("Failed to update store.", "error");
      } else {
        // Update local state optimistically
        setStores((prev) =>
          prev.map((store) =>
            store.store_id === editStoreId
              ? { ...store, store_name: editStoreName, location: editStoreLocation }
              : store
          )
        );
        setShowEditModal(false);
        showNotification("Store updated successfully.", "success");
      }
    } catch (err) {
      console.error("Unexpected error editing store:", err);
      showNotification("Unexpected error occurred while updating the store.", "error");
    }
  };

  // -------------------------
  // DELETE STORE Functions (using custom modal)
  // -------------------------
  const handleDeleteStoreClick = (e, storeId) => {
    e.stopPropagation();
    if (!isAdmin) return;
    setStoreToDelete(storeId);
  };

  const confirmDeleteStore = async () => {
    if (!storeToDelete) return;
    try {
      const { error } = await supabase
        .from("store")
        .delete()
        .eq("store_id", storeToDelete);
      if (error) {
        console.error("Error deleting store:", error);
        showNotification("Failed to delete store.", "error");
      } else {
        setStores((prev) => prev.filter((store) => store.store_id !== storeToDelete));
        showNotification(`Store deleted successfully.`, "success");
      }
    } catch (err) {
      console.error("Unexpected delete error:", err);
      showNotification("Unexpected error occurred while deleting the store.", "error");
    } finally {
      setStoreToDelete(null);
    }
  };

  const cancelDeleteStore = () => {
    setStoreToDelete(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="p-4 text-center text-red-500">Access Denied</div>
    );
  }
  if (loading) {
    return <div className="p-4">Loading stores...</div>;
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
        <h1 className="text-4xl font-bold text-gray-800 mb-4 sm:mb-0">Stores</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-semibold shadow"
        >
          + Add Team
        </button>
      </div>
      {/* Store Cards */}
      <div className="space-y-6">
        {stores.map((store) => (
          <div
            key={store.store_id}
            className="bg-white rounded-lg shadow p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between border border-gray-200"
          >
            <div className="mb-4 sm:mb-0">
              <div className="text-2xl font-semibold text-gray-900">{store.store_name}</div>
              <div className="text-base text-blue-900 mt-1">{store.employee_count} Employee{store.employee_count === 1 ? '' : 's'}</div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
              <button className="flex items-center border border-gray-300 rounded-lg px-4 py-2 text-base font-medium text-gray-900 bg-white hover:bg-gray-100 transition">
                <span className="mr-2">&#128101;</span>
                {store.employee_count} Employee{store.employee_count === 1 ? '' : 's'}
              </button>
              <button className="flex items-center border border-gray-300 rounded-lg px-4 py-2 text-base font-medium text-gray-900 bg-white hover:bg-gray-100 transition">
                <span className="mr-2">&#128100;</span>
                View Employees
              </button>
              {isAdmin && (
                <button
                  className="flex items-center border border-gray-300 rounded-lg px-4 py-2 text-base font-medium text-red-600 bg-white hover:bg-red-50 transition"
                  onClick={e => { e.stopPropagation(); handleDeleteStoreClick(e, store.store_id); }}
                >
                  <span className="mr-2">&#128465;</span>
                  Delete Team
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Add Team Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-96 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Add New Team</h2>
            <form onSubmit={handleSubmitAddStore}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Store Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., 'Main Street Store'"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Location
                </label>
                <input
                  type="text"
                  value={newStoreLocation}
                  onChange={(e) => setNewStoreLocation(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., '123 Main St, Anytown'"
                />
              </div>
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
                  className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Add Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {storeToDelete && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-80">
            <h2 className="text-2xl font-bold mb-6">Confirm Delete</h2>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this team? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={cancelDeleteStore}
                className="px-5 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteStore}
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

export default StoresPage;
