import React, { useState } from 'react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  return firstDay === 6 ? 0 : firstDay + 1; // Adjust to start week on Sunday
}

function getToday() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

// Modular calendar with range selection
const CalendarWidget = ({ initialDate, onRangeChange }) => {
  const today = getToday();
  const initial = initialDate ? new Date(initialDate) : new Date();
  const [currentYear, setCurrentYear] = useState(initial.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initial.getMonth());
  const [selectedDate, setSelectedDate] = useState(initial.getDate());

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const handlePrev = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDate(null); // Reset selected date when changing months
  };

  const handleNext = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDate(null); // Reset selected date when changing months
  };

  // Build calendar grid
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

  // Helper: check if a date is between start and end (exclusive)
  function isInRange(year, month, day) {
    if (!range.start || !range.end) return false;
    const date = new Date(year, month, day).setHours(0,0,0,0);
    const start = new Date(range.start).setHours(0,0,0,0);
    const end = new Date(range.end).setHours(0,0,0,0);
    return date > start && date < end;
  }
  function isSameDay(date, year, month, day) {
    if (!date) return false;
    return (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    );
  }

  // Responsive month/year label
  const monthLabel = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div
      className="rounded-2xl shadow bg-white p-4 flex flex-col items-center"
      style={{ aspectRatio: '1 / 1', width: '100%', maxWidth: 320, minWidth: 200 }}
    >
      <div className="flex flex-col w-full h-full">
        <div className="flex items-center justify-between w-full mb-2">
          <button
            className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xl font-bold"
            onClick={handlePrev}
            aria-label="Previous Month"
          >
            {'<'}
          </button>
          <div
            className="text-lg font-semibold select-none text-center flex-1 truncate px-2"
            style={{ minWidth: 0 }}
            title={monthLabel}
          >
            {monthLabel}
          </div>
          <button
            className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xl font-bold"
            onClick={handleNext}
            aria-label="Next Month"
          >
            {'>'}
          </button>
        </div>
        <div className="grid grid-cols-7 gap-y-1 w-full text-center flex-1">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="text-gray-500 font-medium text-sm pb-1 select-none">{wd}</div>
          ))}
          {days.map((d, i) => {
            if (!d) return <div key={i} className="py-1" />;
            const isStart = isSameDay(range.start, currentYear, currentMonth, d);
            const isEnd = isSameDay(range.end, currentYear, currentMonth, d);
            const inRange = isInRange(currentYear, currentMonth, d);
            return (
              <button
                key={i}
                className={`py-1 text-base select-none w-full h-full flex items-center justify-center rounded-full transition ${
                  today.year === currentYear && today.month === currentMonth && today.day === d
                    ? 'bg-blue-600 text-white font-bold'
                    : selectedDate === d
                    ? 'bg-blue-300 text-white font-bold'
                    : 'text-gray-800 hover:bg-blue-200'
                }`}
                onClick={() => {
                  setSelectedDate(d);
                  const selectedDateObj = new Date(currentYear, currentMonth, d);
                  if (typeof onDateSelect === 'function') {
                    onDateSelect(selectedDateObj);
                  }
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CalendarWidget;
