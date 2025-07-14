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
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">New Chat</h2>
          <button onClick={onClose}>
            <X className="w-6 h-6 text-gray-600 hover:text-gray-800" />
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search coworkers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring"
          />
        </div>

        {/* List */}
        {filteredEmployees.length ? (
          <ul className="max-h-60 overflow-y-auto space-y-2">
            {filteredEmployees.map((emp) => (
              <li
                key={emp.employee_id}
                onClick={() => setSelected(emp.employee_id)}
                className={`flex items-center p-2 rounded-lg cursor-pointer transition ${
                  selected === emp.employee_id ? "bg-blue-100" : "hover:bg-gray-100"
                }`}
              >
                <img
                  src={emp.avatar}
                  alt={`${emp.first_name} ${emp.last_name}`}
                  className="w-8 h-8 rounded-full mr-3"
                />
                <span className="flex-1">
                  {emp.first_name} {emp.last_name}
                </span>
                {selected === emp.employee_id && (
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-gray-500">No one left to chat with.</p>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onCreate}
            disabled={!selected}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            Create Chat
          </button>
        </div>
      </div>
    </div>
  );
}
