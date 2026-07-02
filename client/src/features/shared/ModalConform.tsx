import React, { createContext, useContext, useState, useRef } from "react";
import { Terminal, AlertTriangle } from "lucide-react";

interface ConformOptions {
  title: string;
  message: string;
  conformText?: string;
  cancelText?: string;
  variant?: "danger" | "info" | "warning";
}

type ConformFunction = (options: ConformOptions) => Promise<boolean>;

const ConformContext = createContext<ConformFunction | null>(null);

export function useConform() {
  const context = useContext(ConformContext);
  if (!context) {
    throw new Error("useConform must be used within a ConformProvider");
  }
  return context;
}

export function ConformProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConformOptions | null>(null);
  const resolverRef = useRef<(value: boolean) => void>(() => {});

  const conform = (opts: ConformOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  };

  const handleConform = () => {
    setIsOpen(false);
    resolverRef.current(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolverRef.current(false);
  };

  return (
    <ConformContext.Provider value={conform}>
      {children}
      {isOpen && options && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
          <div className="relative w-full max-w-md border border-cyan-500/30 bg-slate-900/90 p-6 rounded-2xl shadow-[0_0_30px_rgba(0,240,255,0.15)] space-y-6 font-mono text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Top decorative line */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
            
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              {options.variant === "danger" ? (
                <AlertTriangle className="text-rose-500 shrink-0" size={20} />
              ) : (
                <Terminal className="text-cyan-400 shrink-0" size={20} />
              )}
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {options.title}
              </h3>
            </div>

            {/* Message */}
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              {options.message}
            </p>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-slate-850 rounded-xl bg-slate-950/40 text-slate-400 text-xs font-bold hover:bg-slate-800/60 hover:text-slate-200 transition-all uppercase tracking-wider cursor-pointer"
              >
                {options.cancelText || "Hủy"}
              </button>
              <button
                onClick={handleConform}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${
                  options.variant === "danger"
                    ? "bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30 hover:shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                    : "bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                }`}
              >
                {options.conformText || "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConformContext.Provider>
  );
}
