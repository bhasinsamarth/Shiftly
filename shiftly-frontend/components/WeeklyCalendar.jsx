import React, { useState } from 'react';
import CalendarWidget from './CalendarWidget';
import { getWeekRange } from '../utils/calendarUtils';

const WeeklyCalendar = ({ onWeekSelect }) => {  // <-- accept onWeekSelect prop
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [highlightedDates, setHighlightedDates] = useState([]);

  const handleDateClick = (date) => {
    const week = getWeekRange(date);
    setHighlightedDates(week);

    if (typeof onWeekSelect === 'function') {
      onWeekSelect(date);   // <-- send clicked date up to parent
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
    />
  );
};

export default WeeklyCalendar;
