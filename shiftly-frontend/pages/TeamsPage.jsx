// --- MANAGE STORES PAGE (formerly TeamsPage) ---
// All UI and logic now refer to 'Store' instead of 'Team'.

import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { COMMON_TIMEZONES, getTimezoneOffset } from "../utils/timezoneUtils";
import TimezoneDropdown from "../components/TimezoneDropdown";

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
  const [newStoreAddress1, setNewStoreAddress1] = useState("");
  const [newStoreAddress2, setNewStoreAddress2] = useState("");
  const [newStoreCity, setNewStoreCity] = useState("");
  const [newStoreProvince, setNewStoreProvince] = useState("");
  const [newStorePostalCode, setNewStorePostalCode] = useState("");
  const [newStoreCountry, setNewStoreCountry] = useState("");

  // -------------------------
  // Edit Store Modal States (future functionality)
  // -------------------------
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStoreId, setEditStoreId] = useState(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editStoreAddress1, setEditStoreAddress1] = useState("");
  const [editStoreAddress2, setEditStoreAddress2] = useState("");
  const [editStoreCity, setEditStoreCity] = useState("");
  const [editStoreProvince, setEditStoreProvince] = useState("");
  const [editStorePostalCode, setEditStorePostalCode] = useState("");
  const [editStoreCountry, setEditStoreCountry] = useState("");

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
        .select("store_id, store_name, address_line_1, address_line_2, city, province, postal_code, country");
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
    setNewStoreAddress1("");
    setNewStoreAddress2("");
    setNewStoreCity("");
    setNewStoreProvince("");
    setNewStorePostalCode("");
    setNewStoreCountry("");
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
        .insert([{ 
          store_name: newStoreName, 
          address_line_1: newStoreAddress1,
          address_line_2: newStoreAddress2,
          city: newStoreCity,
          province: newStoreProvince,
          postal_code: newStorePostalCode,
          country: newStoreCountry
        }]);
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
    setEditStoreAddress1(store.address_line_1 || "");
    setEditStoreAddress2(store.address_line_2 || "");
    setEditStoreCity(store.city || "");
    setEditStoreProvince(store.province || "");
    setEditStorePostalCode(store.postal_code || "");
    setEditStoreCountry(store.country || "");
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
        .update({ 
          store_name: editStoreName, 
          address_line_1: editStoreAddress1,
          address_line_2: editStoreAddress2,
          city: editStoreCity,
          province: editStoreProvince,
          postal_code: editStorePostalCode,
          country: editStoreCountry
        })
        .eq("store_id", editStoreId);
      if (error) {
        console.error("Error updating store:", error);
        showNotification("Failed to update store.", "error");
      } else {
        setStores((prev) =>
          prev.map((store) =>
            store.store_id === editStoreId
              ? { ...store, store_name: editStoreName, address_line_1: editStoreAddress1, address_line_2: editStoreAddress2, city: editStoreCity, province: editStoreProvince, postal_code: editStorePostalCode, country: editStoreCountry }
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
        <h1 className="text-4xl font-bold text-gray-800 mb-4 sm:mb-0">
          Stores
        </h1>
        {/* Add Team button on the opposite side */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-semibold shadow"
          >
            + Add Store
          </button>
        </div>
      </div>
      {/* Add Store Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-96 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Add New Store</h2>
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
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={newStoreAddress1 || ''}
                  onChange={(e) => setNewStoreAddress1(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., '123 Main St'"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={newStoreAddress2 || ''}
                  onChange={(e) => setNewStoreAddress2(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Apt, Suite, etc."
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  City
                </label>
                <input
                  type="text"
                  value={newStoreCity || ''}
                  onChange={(e) => setNewStoreCity(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Province
                </label>
                <input
                  type="text"
                  value={newStoreProvince || ''}
                  onChange={(e) => setNewStoreProvince(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={newStorePostalCode || ''}
                  onChange={(e) => setNewStorePostalCode(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Country
                </label>
                <input
                  type="text"
                  value={newStoreCountry || ''}
                  onChange={(e) => setNewStoreCountry(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
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
                  className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Add Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Stores listing */}
      {stores.length === 0 ? (
        <p className="text-gray-700 text-lg">No stores found.</p>
      ) : (
        stores.map((store) => (
          <div
            key={store.store_id}
            className="mb-6 bg-white p-6 rounded-lg shadow hover:shadow-xl transition-shadow cursor-pointer border border-gray-200"
            onClick={() => toggleStoreGroup(store.store_id)}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-800">
                {store.store_name}
              </h2>
              <div className="flex items-center space-x-4">
                <span className="text-gray-500">{store.city}, {store.province} {store.postal_code}</span>
                <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
                  {store.employee_count} Employees
                </span>
                <VIcon open={openStores[store.store_id]} />
                {/* Delete Team button for each team */}
                {isAdmin && (
                  <button
                    className="ml-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                    onClick={e => handleDeleteStoreClick(e, store.store_id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            {openStores[store.store_id] && (
              <div className="mt-4 border-t pt-4">
                <p className="text-gray-700">Store ID: {store.store_id}</p>
                <p className="text-gray-700">Address: {store.address_line_1} {store.address_line_2 && (", " + store.address_line_2)}, {store.city}, {store.province}, {store.postal_code}, {store.country}</p>
              </div>
            )}
          </div>
        )
      )
    )
      }
      {/* Edit Store Modal (future functionality) */}
      {showEditModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-96 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Edit Store</h2>
            <form onSubmit={handleSubmitEditStore}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Store Name
                </label>
                <input
                  type="text"
                  value={editStoreName}
                  onChange={(e) => setEditStoreName(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., 'Main Street Store'"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={editStoreAddress1 || ''}
                  onChange={(e) => setEditStoreAddress1(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., '123 Main St'"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={editStoreAddress2 || ''}
                  onChange={(e) => setEditStoreAddress2(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Apt, Suite, etc."
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  City
                </label>
                <input
                  type="text"
                  value={editStoreCity || ''}
                  onChange={(e) => setEditStoreCity(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Province
                </label>
                <input
                  type="text"
                  value={editStoreProvince || ''}
                  onChange={(e) => setEditStoreProvince(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={editStorePostalCode || ''}
                  onChange={(e) => setEditStorePostalCode(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Country
                </label>
                <input
                  type="text"
                  value={editStoreCountry || ''}
                  onChange={(e) => setEditStoreCountry(e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
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
      {storeToDelete && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-80">
            <h2 className="text-2xl font-bold mb-6">Confirm Delete</h2>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this store? This action cannot be undone.
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
