import React from 'react';

export default function NewPrivateModal({
  allEmployees,      // filtered list
  selected,          // employee_id or null
  setSelected,       // fn to set selected
  onCreate,
  onClose,
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center">
      <div className="bg-white p-6 rounded shadow-lg w-80">
        <h3 className="text-lg font-semibold mb-3">New Direct Message</h3>
        <select
          value={selected || ''}
          onChange={e => setSelected(Number(e.target.value))}
          className="border p-2 w-full rounded mb-4"
        >
          <option value="" disabled>
            Select a user...
          </option>
          {allEmployees.map(emp => (
            <option key={emp.employee_id} value={emp.employee_id}>
              {emp.first_name} {emp.last_name}
            </option>
          ))}
        </select>
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
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
