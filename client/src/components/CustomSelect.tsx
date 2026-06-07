import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: SelectOption[];
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  className = "",
  disabled = false,
  placeholder = "Chọn tùy chọn...",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (val: any) => {
    if (disabled) return;
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${isOpen ? "z-[9999]" : ""} ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs px-3 py-2 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 focus:outline-none font-bold transition-all text-left cursor-pointer hover:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed ${
          isOpen ? "ring-2 ring-cyan-500/20 border-cyan-500" : ""
        }`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? "transform rotate-180 text-cyan-400" : ""
          }`}
        />
      </button>

      {/* Dropdown Options List */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-full min-w-[200px] max-h-60 overflow-y-auto bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-lg shadow-[0_4px_25px_rgba(0,0,0,0.5)] z-[10000] p-1 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {options.length === 0 ? (
            <div className="p-2 text-center text-xs text-slate-500 italic font-mono">
              Không có tùy chọn
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              const isDisabled = opt.disabled || false;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && handleSelect(opt.value)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs font-semibold font-mono transition-all cursor-pointer ${
                    isDisabled
                      ? "text-slate-650 cursor-not-allowed opacity-40 bg-transparent"
                      : isSelected
                      ? "bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                      : "text-slate-450 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <span className="truncate block">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
