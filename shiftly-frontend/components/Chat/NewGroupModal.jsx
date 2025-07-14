import React, { useMemo } from 'react';
import { CheckSquare } from 'lucide-react';

export default function NewGroupModal({
  allEmployees,    // filtered list
  selected,        // array of employee_id
  setSelected,     // fn to update selected[]
  groupName,
  setGroupName,
  error,
  onCreate,
  onClose,
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center">
      <div className="bg-white p-6 rounded shadow-lg w-96">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <CheckSquare className="mr-2 h-5 w-5 text-gray-600" /> Create New Group
        </h3>
        <input
          type="text"
          placeholder="Group Name"
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
          className="border p-2 w-full rounded mb-3"
        />
        <input
          type="text"
          placeholder="Search members..."
          onChange={e => {/* parent controls searchQuery*/}}
          className="border p-2 w-full rounded mb-3"
        />
        {error && <div className="text-red-500 mb-2">{error}</div>}
        <label className="flex items-center mb-2 text-sm font-medium">
          <CheckSquare className="mr-2 h-4 w-4 text-gray-600" /> Select Members
        </label>
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {allEmployees.map(emp => (
            <label key={emp.employee_id} className="flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-blue-600"
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
                className="h-6 w-6 rounded-full ml-2"
              />
              <span className="ml-2">
                {emp.first_name} {emp.last_name}
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded border"
          >
            Cancel
          </button>
          <button
            onClick={onCreate}
            className="px-3 py-1 bg-blue-600 text-white rounded"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
