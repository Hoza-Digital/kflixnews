"use client";

import { useEffect, useRef, useState } from "react";

type DateRangePickerProps = {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const DAY_NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Convert Sunday=0 to Monday=0, Sunday=6
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDayClick = (dayNumber: number) => {
    const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNumber);
    
    if (!startDate || (startDate && endDate)) {
      onChange(clickedDate, null);
    } else if (startDate && !endDate) {
      if (clickedDate < startDate) {
        onChange(clickedDate, null);
      } else {
        onChange(startDate, clickedDate);
        setIsOpen(false);
      }
    }
  };

  const isSelected = (dayDate: Date) => {
    if (startDate && dayDate.getTime() === startDate.getTime()) return true;
    if (endDate && dayDate.getTime() === endDate.getTime()) return true;
    return false;
  };

  const isInRange = (dayDate: Date) => {
    if (startDate && endDate) {
      return dayDate >= startDate && dayDate <= endDate;
    }
    if (startDate && !endDate && hoverDate) {
      return (dayDate >= startDate && dayDate <= hoverDate) || (dayDate <= startDate && dayDate >= hoverDate);
    }
    return false;
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const formatDisplay = () => {
    const formatOptions: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "2-digit" };
    if (startDate && endDate) {
      const startStr = startDate.toLocaleDateString("en-US", formatOptions);
      const endStr = endDate.toLocaleDateString("en-US", formatOptions);
      if (startStr === endStr) {
        return startStr;
      }
      return `${startStr} - ${endStr}`;
    }
    if (startDate) {
      return `${startDate.toLocaleDateString("en-US", formatOptions)} - End`;
    }
    return "Select date";
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, null);
  };

  return (
    <div className="date-picker-wrapper" ref={popoverRef}>
      <div className="date-picker-trigger gallery-page-search" onClick={() => setIsOpen(!isOpen)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
        <span>{formatDisplay()}</span>
        {(startDate || endDate) && (
          <button className="date-picker-clear" onClick={clearSelection} title="Clear dates" type="button">
            &times;
          </button>
        )}
      </div>

      {isOpen && (
        <div className="date-picker-popover">
          <div className="calendar-header">
            <button type="button" onClick={handlePrevMonth}>&lsaquo;</button>
            <strong>{MONTH_NAMES[month]} {year}</strong>
            <button type="button" onClick={handleNextMonth}>&rsaquo;</button>
          </div>
          
          <div className="calendar-grid">
            {DAY_NAMES.map(d => (
              <div key={d} className="calendar-day-name">{d}</div>
            ))}
            
            {days.map((d, i) => {
              if (d === null) return <div key={`empty-${i}`} className="calendar-day empty" />;
              
              const dayDate = new Date(year, month, d);
              const isDisabled = dayDate > today;
              const selected = isSelected(dayDate);
              const inRange = isInRange(dayDate);
              
              let className = "calendar-day";
              if (selected) className += " selected";
              if (inRange) className += " in-range";
              if (isDisabled) className += " disabled";

              return (
                <div
                  key={`day-${d}`}
                  className={className}
                  onClick={() => !isDisabled && handleDayClick(d)}
                  onMouseEnter={() => !isDisabled && setHoverDate(dayDate)}
                  onMouseLeave={() => !isDisabled && setHoverDate(null)}
                >
                  <span className="calendar-day-inner">{d}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
