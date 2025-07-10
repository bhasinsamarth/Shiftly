import React, { useState } from 'react';
import CalendarWidget from './CalendarWidget';

const RangeCalendar = () => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);

  const handleDateClick = (date) => {
    if (!start || (start && end)) {
      setStart(date);
      setEnd(null);
    } else if (start && !end) {
      if (date < start) {
        setStart(date);
        setEnd(start);
      } else {
        setEnd(date);
      }
    }
  };

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

  return (
    <CalendarWidget
      year={currentYear}
      month={currentMonth}
      highlightedDates={highlightedDates}
      onDateClick={handleDateClick}
    />
  );
};

export default RangeCalendar;
