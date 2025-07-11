
import React from 'react';
import { WEEKDAYS } from './calendarUtils';

const CalendarWidget = ({
  year,
  month,
  highlightedDates = [],
  selectedDate = null,
  onDateClick,
  onMonthChange, // <-- add this prop
}) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();


  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }
  while (days.length % 7 !== 0) {
    days.push(null);
  }


  const monthLabel = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

  const isHighlighted = (date) => highlightedDates.some(
    (d) => d.getFullYear() === date.getFullYear() &&
           d.getMonth() === date.getMonth() &&
           d.getDate() === date.getDate()
  );

  const isSelected = (date) =>
    selectedDate &&
    date.getFullYear() === selectedDate.getFullYear() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getDate() === selectedDate.getDate();


  return (
    <div
      className="rounded-2xl shadow bg-white p-4 flex flex-col items-center"
      style={{ aspectRatio: '1 / 1', width: '100%', maxWidth: 320, minWidth: 200 }}
    >
      <div className="flex items-center justify-between w-full mb-2">
        <button
          className="px-2 py-1 text-lg font-bold text-blue-700 hover:bg-blue-100 rounded"
          onClick={() => onMonthChange && onMonthChange(year, month - 1)}
          aria-label="Previous Month"
          type="button"
        >
          &#8592;
        </button>
        <div className="text-lg font-semibold">{monthLabel}</div>
        <button
          className="px-2 py-1 text-lg font-bold text-blue-700 hover:bg-blue-100 rounded"
          onClick={() => onMonthChange && onMonthChange(year, month + 1)}
          aria-label="Next Month"
          type="button"
        >
          &#8594;
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 w-full text-center flex-1">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="text-gray-500 font-medium text-sm pb-1 select-none">{wd}</div>
        ))}
        {days.map((d, i) => {
          if (!d) return <div key={i} className="py-1" />;
          const thisDate = new Date(year, month, d);
          const isToday = todayYear === year && todayMonth === month && todayDate === d;
          const highlighted = isHighlighted(thisDate);
          const selected = isSelected(thisDate);

          let className = 'py-1 text-base select-none w-full h-full flex items-center justify-center transition ';
          if (selected) {
            className += 'bg-blue-900 text-white font-bold rounded-full ';
          } else if (highlighted) {
            className += 'bg-blue-200 text-blue-800 font-semibold rounded-full ';
          } else if (isToday) {
            className += 'border-2 border-blue-600 text-blue-700 font-bold rounded-full ';
          } else {
            className += 'text-gray-800 hover:bg-blue-100 rounded-full ';
          }

          return (
            <button
              key={i}
              className={className}
              onClick={() => onDateClick(thisDate)}
              aria-label={`Select ${thisDate.toLocaleDateString()}`}
              type="button"
            >
              {d}
            </button>
          );
        })}

      </div>
    </div>
  );
};

export default CalendarWidget;
