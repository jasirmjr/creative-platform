import React, { useState } from 'react';

/**
 * InteractiveCalendarPicker
 * Custom calendar component that highlights:
 * - 🔴 Booked platform shoots
 * - 🟠 Off-duty / blackout dates
 * - 🔵 Selected client shoot range
 * - 🟢 Available open dates
 */
export default function InteractiveCalendarPicker({
  startDate,
  endDate,
  onChange,
  blockedRanges = [],
  minDate = new Date().toISOString().split('T')[0],
}) {
  // Calendar month state
  const initialDate = startDate ? new Date(startDate) : new Date();
  const [currentMonthDate, setCurrentMonthDate] = useState(
    isNaN(initialDate.getTime()) ? new Date() : initialDate
  );

  // Selection step: 'start' | 'end'
  const [selectingStep, setSelectingStep] = useState(startDate && !endDate ? 'end' : 'start');
  const [hoverDate, setHoverDate] = useState(null);
  const [calendarError, setCalendarError] = useState('');

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Build days array (with leading empty slots)
  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  // Helper to find conflict on a specific date YYYY-MM-DD
  const getDateStatus = (dateStr) => {
    for (const b of blockedRanges) {
      const bStart = b.start_date.split('T')[0];
      const bEnd = b.end_date.split('T')[0];
      if (dateStr >= bStart && dateStr <= bEnd) {
        return b;
      }
    }
    return null;
  };

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  // Check if current selected range has a conflict
  const selectedRangeConflict = (() => {
    if (!startDate || !endDate || blockedRanges.length === 0) return null;
    for (const b of blockedRanges) {
      const bStart = b.start_date.split('T')[0];
      const bEnd = b.end_date.split('T')[0];
      if (!(endDate < bStart || startDate > bEnd)) {
        return b;
      }
    }
    return null;
  })();

  const handleDayClick = (dateStr) => {
    setCalendarError('');
    const status = getDateStatus(dateStr);

    if (status) {
      setCalendarError(
        `Unavailable: This date is ${
          status.type === 'booking'
            ? `already booked for "${status.project_name || 'Production'}"`
            : `marked off-duty (${status.reason || 'Unavailable'})`
        }. Please pick an open date.`
      );
      return;
    }

    if (dateStr < minDate) {
      setCalendarError('Cannot select dates in the past.');
      return;
    }

    // Set automatically the end date as start date initially!
    if (selectingStep === 'start' || !startDate || (startDate && endDate && startDate !== endDate)) {
      onChange({ start_date: dateStr, end_date: dateStr });
      setSelectingStep('end');
    } else {
      // Second click extends to multi-day range if no blocked dates in between
      if (dateStr < startDate) {
        onChange({ start_date: dateStr, end_date: dateStr });
        setSelectingStep('end');
      } else {
        const hasBlockedInRange = blockedRanges.some((b) => {
          const bStart = b.start_date.split('T')[0];
          const bEnd = b.end_date.split('T')[0];
          return !(dateStr < bStart || startDate > bEnd);
        });

        if (hasBlockedInRange) {
          setCalendarError(
            'The selected range spans across dates where the vendor is already booked or off-duty. Please pick open dates.'
          );
          return;
        }

        onChange({ start_date: startDate, end_date: dateStr });
        setSelectingStep('start');
      }
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs select-none">
      {/* Calendar Header: Month Switcher */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
            title="Previous Month"
          >
            &larr;
          </button>
          <span className="font-bold text-slate-900 text-sm min-w-[130px] text-center">
            {monthNames[month]} {year}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
            title="Next Month"
          >
            &rarr;
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block"></span>
            <span className="text-slate-600 font-medium">Booked</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block"></span>
            <span className="text-slate-600 font-medium">Off-Duty</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block"></span>
            <span className="text-slate-600 font-medium">Selected</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>
            <span className="text-slate-600 font-medium">Available</span>
          </span>
        </div>
      </div>

      {/* Instruction & Status Alert */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-slate-500 font-medium">
          {selectingStep === 'end' && startDate ? (
            <span className="text-blue-700 font-semibold">
              👉 Click an open date to set <strong>End Date</strong> (Start: {new Date(startDate).toLocaleDateString()})
            </span>
          ) : (
            <span className="text-slate-600">
              👉 Click an open date to set <strong>Start Date</strong>
            </span>
          )}
        </span>

        {startDate && endDate && (
          <button
            type="button"
            onClick={() => {
              onChange({ start_date: '', end_date: '' });
              setSelectingStep('start');
            }}
            className="text-[10px] text-slate-400 hover:text-slate-700 underline cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {calendarError && (
        <div className="mb-2 p-2 bg-amber-50 border border-amber-300 rounded-lg text-[11px] text-amber-900 leading-tight">
          ⚠️ {calendarError}
        </div>
      )}

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {dayNames.map((n) => (
          <div key={n} className="text-[10px] font-bold text-slate-400 uppercase py-0.5">
            {n}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((dayNum, idx) => {
          if (dayNum === null) {
            return <div key={`empty-${idx}`} className="h-8" />;
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const isPast = dateStr < minDate;
          const isToday = dateStr === todayStr;

          const conflict = getDateStatus(dateStr);
          const isBooked = conflict && conflict.type === 'booking';
          const isBlackout = conflict && conflict.type === 'blackout';

          const isStart = startDate === dateStr;
          const isEnd = endDate === dateStr;
          const isInRange =
            startDate &&
            endDate &&
            dateStr > startDate &&
            dateStr < endDate;

          // Compute cell classes
          let cellStyle = 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50';
          let tooltip = 'Available for booking';

          if (isPast) {
            cellStyle = 'bg-slate-100/60 border-transparent text-slate-300 cursor-not-allowed';
            tooltip = 'Past date';
          } else if (isBooked) {
            cellStyle = 'bg-rose-100 border-rose-300 text-rose-800 font-bold cursor-not-allowed';
            tooltip = `Booked Shoot: ${conflict.project_name || 'Production'}`;
          } else if (isBlackout) {
            cellStyle = 'bg-amber-100 border-amber-300 text-amber-900 font-bold cursor-not-allowed';
            tooltip = `Off-Duty / Unavailable: ${conflict.reason || 'Off-Duty'}`;
          } else if (isStart || isEnd) {
            cellStyle = 'bg-blue-600 border-blue-600 text-white font-black shadow-xs ring-2 ring-blue-300/50';
            tooltip = isStart && isEnd ? 'Shoot Date' : isStart ? 'Shoot Start Date' : 'Shoot End Date';
          } else if (isInRange) {
            cellStyle = 'bg-blue-100/90 border-blue-200 text-blue-900 font-semibold';
            tooltip = 'In shoot schedule';
          }

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isPast || Boolean(isBooked) || Boolean(isBlackout)}
              onClick={() => handleDayClick(dateStr)}
              title={tooltip}
              className={`h-8 rounded-lg border text-xs flex items-center justify-center relative transition-all ${
                isPast || isBooked || isBlackout ? 'cursor-not-allowed' : 'cursor-pointer'
              } ${cellStyle} ${
                isToday && !isStart && !isEnd ? 'ring-1 ring-slate-400 font-bold' : ''
              }`}
            >
              <span>{dayNum}</span>

              {/* Status indicator dot / badge */}
              {isBooked && (
                <span
                  className="absolute bottom-0.5 w-1.5 h-1.5 bg-rose-600 rounded-full"
                  title={tooltip}
                />
              )}
              {isBlackout && (
                <span
                  className="absolute bottom-0.5 w-1.5 h-1.5 bg-amber-600 rounded-full"
                  title={tooltip}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer helper */}
      <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
        <div>
          Selected:{' '}
          <strong className="text-slate-800">
            {startDate ? new Date(startDate).toLocaleDateString() : 'None'}
          </strong>{' '}
          &rarr;{' '}
          <strong className="text-slate-800">
            {endDate ? new Date(endDate).toLocaleDateString() : 'None'}
          </strong>
        </div>
        {startDate && endDate && (
          selectedRangeConflict ? (
            <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-300 flex items-center gap-1">
              <span>⚠️</span>
              <span>Unavailable ({selectedRangeConflict.type === 'booking' ? 'Booked' : selectedRangeConflict.reason || 'Off-Duty'})</span>
            </span>
          ) : (
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              ✓ Valid Available Dates
            </span>
          )
        )}
      </div>
    </div>
  );
}
