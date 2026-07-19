import React, { createContext, useContext, useState, useRef } from "react";
import { Terminal, AlertTriangle } from "lucide-react";
import { useLocation } from "react-router-dom";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "info" | "warning";
}

type ConfirmFunction = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction | null>(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<(value: boolean) => void>(() => {});
  const location = useLocation();
  const usesLightShell = location.pathname === '/' || location.pathname === '/team-area' || location.pathname === '/register-team' || location.pathname === '/login' || location.pathname === '/achievements' || location.pathname === '/guest-portal' || location.pathname.startsWith('/admin');

  const confirm = (opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  };

  const handleConfirm = () => {
    setIsOpen(false);
    resolverRef.current(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolverRef.current(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {isOpen && options && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
          <div className={`relative w-full max-w-md p-6 rounded-2xl space-y-6 font-sans animate-in fade-in zoom-in-95 duration-200 ${
            usesLightShell 
              ? "bg-[#faf9f6] border border-slate-200 text-slate-800 shadow-2xl" 
              : "bg-slate-900/90 border border-cyan-500/30 text-slate-200 shadow-[0_0_30px_rgba(0,240,255,0.15)]"
          }`}>
            {/* Top decorative line */}
            <div className={`absolute top-0 left-0 w-full h-[2px] ${
              usesLightShell 
                ? options.variant === "danger" 
                  ? "bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" 
                  : "bg-gradient-to-r from-transparent via-[#F27024]/50 to-transparent"
                : "bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"
            }`}></div>
            
            {/* Header */}
            <div className={`flex items-center gap-3 border-b pb-3 ${
              usesLightShell ? "border-slate-200" : "border-slate-800"
            }`}>
              {options.variant === "danger" ? (
                <AlertTriangle className="text-rose-500 shrink-0" size={20} />
              ) : (
                usesLightShell 
                  ? <Terminal className="text-[#F27024] shrink-0" size={20} />
                  : <Terminal className="text-cyan-400 shrink-0" size={20} />
              )}
              <h3 className={`text-sm font-bold uppercase tracking-wider ${
                usesLightShell ? "text-slate-800" : "text-white"
              }`}>
                {options.title}
              </h3>
            </div>

            {/* Message */}
            <p className={`text-xs leading-relaxed font-sans ${
              usesLightShell ? "text-slate-600" : "text-slate-400"
            }`}>
              {options.message}
            </p>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className={`px-4 py-2 border rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  usesLightShell 
                    ? "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600" 
                    : "bg-slate-950/40 border-slate-850 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                {options.cancelText || "Hủy"}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${
                  usesLightShell 
                    ? options.variant === "danger"
                      ? "bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20"
                      : "bg-[#F27024] hover:bg-[#e05e1b] text-white shadow-lg shadow-[#F27024]/20"
                    : options.variant === "danger"
                      ? "bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30 hover:shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                      : "bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                }`}
              >
                {options.confirmText || "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
