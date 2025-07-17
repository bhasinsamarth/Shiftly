import React, { useMemo, useState } from 'react';
import { CheckSquare } from 'lucide-react';

export default function NewGroupModal({
  allEmployees,
  selected,
  setSelected,
  groupName,
  setGroupName,
  error,
  onCreate,
  onClose,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredEmployees = useMemo(() =>
    allEmployees.filter(emp =>
      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
    ), [allEmployees, searchQuery]
  );

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <CheckSquare className="h-6 w-6 text-blue-600" /> Create New Group
        </h3>
        <input
          type="text"
          placeholder="Group Name"
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <input
          type="text"
          placeholder="Search members..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        {error && <div className="text-red-500 mb-3 text-sm font-medium">{error}</div>}
        <div className="mb-2 text-sm font-semibold text-gray-700">Select Members</div>
        <div className="space-y-2 mb-6 max-h-48 overflow-y-auto pr-1">
          {filteredEmployees.length === 0 && (
            <div className="text-gray-400 text-sm text-center py-4">No employees found</div>
          )}
          {filteredEmployees.map(emp => (
            <label key={emp.employee_id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 cursor-pointer">
              <input
                type="checkbox"
                className="form-checkbox h-5 w-5 text-blue-600 rounded"
                checked={selected.includes(emp.employee_id)}
                onChange={e => {
                  const id = emp.employee_id;
                  setSelected(prev =>
                    e.target.checked
                      ? [...prev, id]
                      : prev.filter(pid => pid !== id)
                  );
                }}
              />
              <img
                src={emp.avatar}
                alt={`${emp.first_name} ${emp.last_name}`}
                className="h-8 w-8 rounded-full object-cover border border-gray-200"
              />
              <span className="ml-1 text-base text-gray-800 font-medium">
                {emp.first_name} {emp.last_name}
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={onCreate}
            className="px-5 py-2 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
