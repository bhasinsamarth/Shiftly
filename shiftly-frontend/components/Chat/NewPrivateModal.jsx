// src/components/Chat/NewPrivateModal.jsx
import React, { useState, useMemo } from "react";
import { X, CheckSquare } from "lucide-react";

export default function NewPrivateModal({
  allEmployees,
  existingPrivateIds = [],
  onCreate,
  onClose,
  selected,
  setSelected,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  // filter out people you already have chats with
  const filteredEmployees = useMemo(() => {
    return allEmployees
      .filter(emp => !existingPrivateIds.includes(emp.employee_id))
      .filter(emp =>
        `${emp.first_name} ${emp.last_name}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      );
  }, [allEmployees, existingPrivateIds, searchQuery]);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">New Chat</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search coworkers..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="mb-6 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
        />

        {/* List */}
        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-1">
          {filteredEmployees.length === 0 && (
            <div className="text-gray-400 text-sm text-center py-4">No coworkers found</div>
          )}
          {filteredEmployees.map(emp => (
            <div
              key={emp.employee_id}
              onClick={() => setSelected(emp.employee_id)}
              className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition ${selected === emp.employee_id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
            >
              <img
                src={emp.avatar}
                alt={`${emp.first_name} ${emp.last_name}`}
                className="h-8 w-8 rounded-full object-cover border border-gray-200"
              />
              <span className="ml-1 text-base text-gray-800 font-medium flex-1">
                {emp.first_name} {emp.last_name}
              </span>
              {selected === emp.employee_id && (
                <CheckSquare className="w-5 h-5 text-blue-600" />
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={onCreate}
            disabled={!selected}
            className="px-5 py-2 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            Create Chat
          </button>
        </div>
      </div>
    </div>
  );
}
