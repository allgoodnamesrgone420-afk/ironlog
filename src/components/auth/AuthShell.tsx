import type { ReactNode } from "react";
import { Activity } from "lucide-react";

export function AuthShell({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <div className="w-full">
      <div className="mb-8">
        <span
          className="plunk face-lime flex h-14 w-14 items-center justify-center"
          style={{ ["--d" as string]: "5px" }}
          aria-hidden
        >
          <Activity className="h-7 w-7" strokeWidth={2.75} />
        </span>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight">IronLog</h1>
        {subtitle && <p className="mt-1 text-ink-2">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}

/** Boxed input with the label inside the box (see .field in globals.css). */
export function Field({ label, type = "text", value, onChange, placeholder, autoComplete, required, minLength }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
      />
    </label>
  );
}

/** Inline error for auth forms. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 border border-over/60 bg-over/10 p-3 text-sm">
      <span className="mt-0.5 h-2.5 w-2.5 shrink-0 bg-over" aria-hidden />
      {children}
    </p>
  );
}
