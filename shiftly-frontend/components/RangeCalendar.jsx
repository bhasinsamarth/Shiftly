import React from 'react';
import CalendarWidget from './CalendarWidget';

const RangeCalendar = ({ selectedRange, onRangeSelect, onDateClick, activePick }) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = React.useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = React.useState(today.getMonth());

  // Highlighted dates logic
  const { start, end } = selectedRange || {};
  const highlightedDates = [];
  if (start && end) {
    let d = new Date(start);
    while (d <= end) {
      highlightedDates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
  } else if (start) {
    highlightedDates.push(start);
  }

  // Handle date click
  const handleDateClick = (date) => {
    if (onDateClick) {
      onDateClick(date);
    } else if (onRangeSelect) {
      // fallback: old behavior
      if (!start || (start && end)) {
        onRangeSelect({ start: date, end: null });
      } else if (start && !end) {
        if (date < start) {
          onRangeSelect({ start: date, end: start });
        } else {
          onRangeSelect({ start, end: date });
        }
      }
    }
  };

  // Add month navigation handler
  const handleMonthChange = (year, month) => {
    let newYear = year;
    let newMonth = month;
    if (newMonth < 0) {
      newYear -= 1;
      newMonth = 11;
    } else if (newMonth > 11) {
      newYear += 1;
      newMonth = 0;
    }
    setCurrentYear(newYear);
    setCurrentMonth(newMonth);
  };

  return (
    <CalendarWidget
      year={currentYear}
      month={currentMonth}
      highlightedDates={highlightedDates}
      onDateClick={handleDateClick}
      onMonthChange={handleMonthChange}
      activePick={activePick}
    />
  );
};

export default RangeCalendar;
