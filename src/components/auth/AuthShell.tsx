import type { ReactNode } from "react";
import { Activity } from "lucide-react";

export function AuthShell({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8">
        <div className="bg-brand-600 p-4 rounded-2xl shadow-lg shadow-brand-100 dark:shadow-none mb-4">
          <Activity className="text-white w-8 h-8" aria-hidden />
        </div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">IronLog</h1>
        {subtitle && <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-center">{subtitle}</p>}
      </div>
      <div className="bg-white dark:bg-zinc-900 p-7 rounded-3xl shadow-lg border border-zinc-100 dark:border-zinc-800">
        {children}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  icon: ReactNode;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}

export function Field({ label, icon, type = "text", value, onChange, placeholder, autoComplete, required, minLength }: FieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 rounded-xl border border-transparent focus-within:border-brand-500 transition-colors">
        <span className="text-zinc-400" aria-hidden>
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className="bg-transparent w-full outline-none text-zinc-800 dark:text-white text-base"
        />
      </div>
    </div>
  );
}
