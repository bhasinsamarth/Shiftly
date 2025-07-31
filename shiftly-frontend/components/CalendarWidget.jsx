import React, { useMemo } from 'react';
import { WEEKDAYS } from '../utils/calendarUtils';
import Holidays from 'date-holidays';

const CalendarWidget = ({
  year,
  month,
  highlightedDates = [],
  selectedDate = null,
  onDateClick,
  onMonthChange,
 
}) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  // Memoize holidays for the year/country/province
  const holidayDates = useMemo(() => {
    const hd = new Holidays('CA', 'AB'); // CA = Canada, AB = Alberta
    const holidays = hd.getHolidays(year);
    return holidays.map(h => ({
      date: new Date(h.date),
      name: h.name
    }));
  }, [year]);

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

  const isHoliday = (date) => holidayDates.some(
    (h) => h.date.getFullYear() === date.getFullYear() &&
           h.date.getMonth() === date.getMonth() &&
           h.date.getDate() === date.getDate()
  );

  const getHolidayName = (date) => {
    const h = holidayDates.find(
      (h) => h.date.getFullYear() === date.getFullYear() &&
              h.date.getMonth() === date.getMonth() &&
              h.date.getDate() === date.getDate()
    );
    return h ? h.name : null;
  };

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
          &#8249;
        </button>
        <div className="text-lg font-semibold">{monthLabel}</div>
        <button
          className="px-2 py-1 text-lg font-bold text-blue-700 hover:bg-blue-100 rounded"
          onClick={() => onMonthChange && onMonthChange(year, month + 1)}
          aria-label="Next Month"
          type="button"
        >
          &#8250;
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
          const holiday = isHoliday(thisDate);
          const holidayName = getHolidayName(thisDate);

          let className = 'py-1 text-base select-none w-9 h-9 flex items-center justify-center transition rounded-full ';
          if (selected) {
            className += 'bg-blue-900 text-white font-bold shadow-lg ';
          } else if (holiday) {
            className += 'bg-red-600 text-white font-bold shadow-lg ';
          } else if (highlighted) {
            className += 'bg-blue-200 text-blue-800 font-semibold ';
          } else if (isToday) {
            className += 'border-2 border-blue-600 text-blue-700 font-bold ';
          } else {
            className += 'text-gray-800 hover:bg-blue-100 ';
          }

          return (
            <div key={i} className="flex flex-col items-center justify-center">
              <button
                className={className}
                onClick={() => onDateClick(thisDate)}
                aria-label={`Select ${thisDate.toLocaleDateString()}`}
                type="button"
                style={{ minWidth: 36, minHeight: 36 }}
              >
                {d}
              </button>
              {holidayName && (
                <span className="text-xs text-red-500 mt-1 whitespace-nowrap font-medium">
                  {holidayName}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarWidget;
