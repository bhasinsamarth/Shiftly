import React, { useState } from 'react';
import CalendarWidget from './CalendarWidget';
import { getWeekRange } from './calendarUtils';

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

  return (
    <CalendarWidget
      year={currentYear}
      month={currentMonth}
      highlightedDates={highlightedDates}
      onDateClick={handleDateClick}
    />
  );
};

export default WeeklyCalendar;
