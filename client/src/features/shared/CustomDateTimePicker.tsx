import React, { useState, useEffect, useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";

interface CustomDateTimePickerProps {
  value: string; // Format: YYYY-MM-DDTHH:MM
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const MONTHS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const validate = (date: Date | null, hr12: number, min: number, ampm: "AM" | "PM"): string => {
  if (!date) return "";
  const newDate = new Date(date);
  let hr24 = hr12 % 12;
  if (ampm === "PM") {
    hr24 += 12;
  }
  newDate.setHours(hr24, min, 0, 0);

  const now = new Date();
  now.setSeconds(0, 0);
  now.setMilliseconds(0);
  if (newDate < now) {
    return "Không chọn thời gian quá khứ";
  }
  return "";
};

const getCombinedDate = (date: Date | null, hr12: number, min: number, ampm: "AM" | "PM"): Date | null => {
  if (!date) return null;
  const newDate = new Date(date);
  let hr24 = hr12 % 12;
  if (ampm === "PM") {
    hr24 += 12;
  }
  newDate.setHours(hr24, min, 0, 0);
  return newDate;
};

export default function CustomDateTimePicker({
  value,
  onChange,
  placeholder = "Chọn thời gian...",
  disabled = false,
}: CustomDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Date state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Time state (12-hour format)
  const [selectedHour, setSelectedHour] = useState(() => {
    let hr = new Date().getHours() % 12;
    return hr === 0 ? 12 : hr;
  });
  const [selectedMinute, setSelectedMinute] = useState(() => new Date().getMinutes());
  const [selectedAmpm, setSelectedAmpm] = useState<"AM" | "PM">(() => new Date().getHours() >= 12 ? "PM" : "AM");
  const [timeError, setTimeError] = useState("");

  // Parse initial value
  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
        setCurrentMonth(parsed);
        
        let hr = parsed.getHours();
        const ampmVal = hr >= 12 ? "PM" : "AM";
        setSelectedAmpm(ampmVal);
        
        hr = hr % 12;
        const hr12 = hr === 0 ? 12 : hr;
        setSelectedHour(hr12);
        setSelectedMinute(parsed.getMinutes());
        
        const err = validate(parsed, hr12, parsed.getMinutes(), ampmVal);
        setTimeError(err);
        return;
      }
    } else {
      setSelectedDate(null);
      const now = new Date();
      let hr = now.getHours();
      const ampmVal = hr >= 12 ? "PM" : "AM";
      setSelectedAmpm(ampmVal);
      hr = hr % 12;
      setSelectedHour(hr === 0 ? 12 : hr);
      setSelectedMinute(now.getMinutes());
      setTimeError("");
    }
  }, [value, isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    if (!disabled) setIsOpen(!isOpen);
  };

  // Helper formatting functions
  const displayFormat = (date: Date | null) => {
    if (!date) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    
    const hr = date.getHours();
    const ampmStr = hr >= 12 ? "PM" : "AM";
    const hr12 = hr % 12 === 0 ? 12 : hr % 12;
    const hrStr = String(hr12).padStart(2, "0");
    const minStr = String(date.getMinutes()).padStart(2, "0");
    
    return `${m}/${d}/${y} ${hrStr}:${minStr} ${ampmStr}`;
  };

  const handleSelectDay = (date: Date) => {
    setSelectedDate(date);
    const err = validate(date, selectedHour, selectedMinute, selectedAmpm);
    setTimeError(err);
  };

  const handleSelectHour = (hr: number) => {
    setSelectedHour(hr);
    const err = validate(selectedDate, hr, selectedMinute, selectedAmpm);
    setTimeError(err);
  };

  const handleSelectMinute = (min: number) => {
    setSelectedMinute(min);
    const err = validate(selectedDate, selectedHour, min, selectedAmpm);
    setTimeError(err);
  };

  const handleSelectAmpm = (ampm: "AM" | "PM") => {
    setSelectedAmpm(ampm);
    const err = validate(selectedDate, selectedHour, selectedMinute, ampm);
    setTimeError(err);
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedDate(null);
    setTimeError("");
    onChange("");
    setIsOpen(false);
  };

  const handleToday = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
    
    let hr = today.getHours();
    const ampmVal = hr >= 12 ? "PM" : "AM";
    setSelectedAmpm(ampmVal);
    
    hr = hr % 12;
    const hr12 = hr === 0 ? 12 : hr;
    setSelectedHour(hr12);
    setSelectedMinute(today.getMinutes());
    
    const err = validate(today, hr12, today.getMinutes(), ampmVal);
    setTimeError(err);
  };

  const handleConfirm = () => {
    if (!selectedDate) return;
    const err = validate(selectedDate, selectedHour, selectedMinute, selectedAmpm);
    if (err) {
      setTimeError(err);
      return;
    }
    
    const newDate = new Date(selectedDate);
    let hr24 = selectedHour % 12;
    if (selectedAmpm === "PM") {
      hr24 += 12;
    }
    newDate.setHours(hr24, selectedMinute, 0, 0);
    
    const y = newDate.getFullYear();
    const m = String(newDate.getMonth() + 1).padStart(2, "0");
    const d = String(newDate.getDate()).padStart(2, "0");
    const h = String(newDate.getHours()).padStart(2, "0");
    const mi = String(newDate.getMinutes()).padStart(2, "0");
    
    onChange(`${y}-${m}-${d}T${h}:${mi}`);
    setIsOpen(false);
  };

  // Calendar calculations
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotalDays = new Date(year, month, 0).getDate();

  const cells = [];
  
  // Previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevTotalDays - i;
    cells.push({
      day: dayNum,
      isCurrentMonth: false,
      date: new Date(year, month - 1, dayNum),
    });
  }

  // Current month
  for (let i = 1; i <= totalDays; i++) {
    cells.push({
      day: i,
      isCurrentMonth: true,
      date: new Date(year, month, i),
    });
  }

  // Next month padding
  const remainingCells = 42 - cells.length;
  for (let i = 1; i <= remainingCells; i++) {
    cells.push({
      day: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i),
    });
  }

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  const isPastDay = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(d);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const hoursArray = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutesArray = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input Display Area */}
      <div
        onClick={toggleOpen}
        className={`w-full bg-slate-900/80 border border-slate-700 hover:border-cyan-500/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none flex justify-between items-center cursor-pointer select-none transition-all ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        } ${isOpen ? "border-cyan-500/80 shadow-[0_0_10px_rgba(0,240,255,0.1)]" : ""}`}
      >
        <span className={value ? "text-white font-mono" : "text-slate-500"}>
          {value ? displayFormat(getCombinedDate(selectedDate, selectedHour, selectedMinute, selectedAmpm)) : placeholder}
        </span>
        <Calendar size={16} className="text-cyan-300 hover:text-cyan-400 shrink-0 cursor-pointer transition-colors" />
      </div>

      {/* Popover DateTime Picker Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 p-4 bg-slate-950 border border-slate-800 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_15px_rgba(0,240,255,0.05)] flex gap-4 animate-fadeIn select-none right-0 md:left-0 md:right-auto min-w-[520px]">
          {/* LEFT: Calendar Section */}
          <div className="w-[260px] border-r border-slate-800/80 pr-4">
            {/* Header: Prev, Month/Year, Next */}
            <div className="flex justify-between items-center mb-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border border-slate-800 hover:border-cyan-500/30 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 transition-all cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              
              <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                {MONTHS[month]} {year}
              </span>
              
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg border border-slate-800 hover:border-cyan-500/30 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 transition-all cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Weekdays Headers */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEKDAYS.map((day) => (
                <div key={day} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-1 font-mono">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid Cells */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {cells.map((cell, idx) => {
                const isSelected = selectedDate ? isSameDay(cell.date, selectedDate) : false;
                const isToday = isSameDay(cell.date, new Date());
                const isDisabled = isPastDay(cell.date);
                
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDay(cell.date)}
                    disabled={isDisabled}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-mono font-semibold transition-all ${
                      isDisabled
                        ? "text-slate-800 opacity-20 cursor-not-allowed"
                        : !cell.isCurrentMonth
                        ? "text-slate-600 hover:text-slate-400 hover:bg-slate-900 cursor-pointer"
                        : isSelected
                        ? "bg-cyan-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)] cursor-pointer"
                        : isToday
                        ? "border border-cyan-500/50 text-cyan-400 cursor-pointer"
                        : "text-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer"
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* Bottom Controls */}
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-900">
              <button
                type="button"
                onClick={handleClear}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-rose-500 transition-colors cursor-pointer"
              >
                Xóa
              </button>
              
              <button
                type="button"
                onClick={handleToday}
                className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                Hôm nay
              </button>
            </div>
          </div>

          {/* RIGHT: Time Selection Section */}
          <div className="flex-1 flex flex-col justify-between">
            <div className="border-b border-slate-800/80 pb-2 mb-2 flex items-center gap-1.5">
              <Clock size={12} className="text-cyan-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thời gian</span>
            </div>

            <div className="flex gap-2 h-[168px]">
              {/* Hour Scroll Column */}
              <div className="flex-1 flex flex-col overflow-y-auto scrollbar-none pr-1">
                {hoursArray.map((hr) => {
                  const active = selectedHour === hr;
                  return (
                    <button
                      key={hr}
                      type="button"
                      onClick={() => handleSelectHour(hr)}
                      className={`w-full py-1.5 mb-1 rounded-lg text-center text-xs font-mono font-semibold transition-all cursor-pointer ${
                        active
                          ? "bg-cyan-500 text-slate-950 font-bold"
                          : "text-slate-400 hover:bg-slate-900 hover:text-white"
                      }`}
                    >
                      {String(hr).padStart(2, "0")}
                    </button>
                  );
                })}
              </div>

              {/* Minute Scroll Column */}
              <div className="flex-1 flex flex-col overflow-y-auto scrollbar-none pr-1">
                {minutesArray.map((min) => {
                  const active = selectedMinute === min;
                  return (
                    <button
                      key={min}
                      type="button"
                      onClick={() => handleSelectMinute(min)}
                      className={`w-full py-1.5 mb-1 rounded-lg text-center text-xs font-mono font-semibold transition-all cursor-pointer ${
                        active
                          ? "bg-cyan-500 text-slate-950 font-bold"
                          : "text-slate-400 hover:bg-slate-900 hover:text-white"
                      }`}
                    >
                      {String(min).padStart(2, "0")}
                    </button>
                  );
                })}
              </div>

              {/* AM/PM Column */}
              <div className="w-[50px] flex flex-col justify-start">
                {(["AM", "PM"] as const).map((ap) => {
                  const active = selectedAmpm === ap;
                  return (
                    <button
                      key={ap}
                      type="button"
                      onClick={() => handleSelectAmpm(ap)}
                      className={`w-full py-2 mb-1.5 rounded-lg text-center text-xs font-mono font-bold transition-all cursor-pointer ${
                        active
                          ? "bg-cyan-500 text-slate-950 font-bold"
                          : "text-slate-400 hover:bg-slate-900 hover:text-white"
                      }`}
                    >
                      {ap}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* OK Button */}
            <div className="pt-2 border-t border-slate-900 flex justify-between items-center">
              {timeError && (
                <span className="text-[10px] text-rose-450 font-bold font-mono">
                  {timeError}
                </span>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!!timeError || !selectedDate}
                className="px-4 py-1.5 bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-cyan-500/20 hover:border-cyan-500 transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ml-auto"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
