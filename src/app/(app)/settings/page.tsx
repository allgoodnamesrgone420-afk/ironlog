"use client";

import { useState } from "react";
import { signOut, sendPasswordResetEmail, deleteUser } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Scale, Palette, Mail, LogOut, AlertTriangle, Target, RotateCcw, Timer } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useUnits } from "@/providers/UnitsProvider";
import { useToast } from "@/providers/ToastProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { useMuscleTargets, type DisplayMuscle } from "@/hooks/useMuscleTargets";
import { useTrackedMuscles } from "@/hooks/useTrackedMuscles";
import { useRestTimerEnabled } from "@/hooks/useRestTimerEnabled";
import { ALL_MUSCLE_ROWS } from "@/components/dashboard/MuscleBalance";
import { Check } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { units, setUnits } = useUnits();
  const toast = useToast();
  const router = useRouter();
  const [resetting, setResetting] = useState(false);

  const resetPassword = async () => {
    if (!user?.email) return;
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success("Reset email sent");
    } catch {
      toast.error("Couldn't send right now.");
    } finally {
      setResetting(false);
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    try {
      await deleteUser(user);
      router.push("/login");
    } catch {
      toast.error("Sign out and back in, then try again.");
    }
  };

  return (
    <div className="stagger mx-auto max-w-[640px] space-y-5">
      <header style={{ ["--i" as string]: 0 }}>
        <p className="label">Settings</p>
        <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">Your preferences</h1>
      </header>

      {/* Units */}
      <Card variant="flat" className="p-4">
        <Section icon={<Scale className="h-3.5 w-3.5" />} title="Units">
          <Tabs
            label="Units"
            value={units}
            options={[
              { value: "kg", label: "Kilograms" },
              { value: "lb", label: "Pounds" },
            ]}
            onChange={(v) => setUnits(v as "kg" | "lb")}
          />
        </Section>
      </Card>

      {/* Theme */}
      <Card variant="flat" className="p-4">
        <Section icon={<Palette className="h-3.5 w-3.5" />} title="Theme">
          <Tabs
            label="Theme"
            value={theme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
            onChange={(v) => setTheme(v as "light" | "dark" | "system")}
          />
        </Section>
      </Card>

      {/* Rest timer toggle */}
      <RestTimerToggle />

      {/* Which muscles to track */}
      <TrackedMusclesEditor />

      {/* Muscle targets */}
      <MuscleTargetsEditor />

      {/* Account */}
      <Card className="space-y-3 p-4">
        <Section icon={<Mail className="h-3.5 w-3.5" />} title="Account">
          <p className="break-all text-sm font-semibold">{user?.email}</p>
          {user && !user.emailVerified && (
            <p className="flex items-center gap-2 border border-warn/60 bg-warn/10 px-3 py-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warn" /> Email not verified.
            </p>
          )}
        </Section>
        <Button variant="secondary" onClick={resetPassword} loading={resetting} block>
          Send password reset email
        </Button>
        <Button variant="secondary" onClick={() => signOut(auth)} block>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
        <Confirm
          title="Delete account?"
          message="This permanently removes your sign-in. Workout data deletion is handled separately by Firebase."
          confirmLabel="Delete"
          destructive
          onConfirm={deleteAccount}
          trigger={(open) => (
            <Button variant="ghost" onClick={open} block className="text-over hover:text-over">
              Delete account
            </Button>
          )}
        />
      </Card>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="label flex items-center gap-1.5">
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

function RestTimerToggle() {
  const { enabled, setEnabled } = useRestTimerEnabled();
  return (
    <Card variant="flat" className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="label flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5" /> Rest timer
          </h2>
          <p className="mt-1 text-sm text-ink-2">Auto-start a countdown after completing a set.</p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          role="switch"
          aria-checked={enabled}
          aria-label="Rest timer"
          className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center border border-line transition-colors ${
            enabled ? "bg-lime" : "bg-field"
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transition-transform ${
              enabled ? "translate-x-[26px] bg-[#0d0d0d]" : "translate-x-[3px] bg-ink-3"
            }`}
          />
        </button>
      </div>
    </Card>
  );
}

function TrackedMusclesEditor() {
  const { tracked, toggle, reset } = useTrackedMuscles();
  return (
    <Card variant="flat" className="space-y-3 p-4">
      <Section icon={<Target className="h-3.5 w-3.5" />} title="Tracked muscles">
        <p className="text-sm text-ink-2">
          Choose which muscles show up on your dashboard balance. Care about glutes more than chest? Toggle them.
        </p>
      </Section>
      <div className="grid grid-cols-2 gap-2">
        {ALL_MUSCLE_ROWS.map((r) => {
          const on = tracked.includes(r.key);
          return (
            <button
              key={r.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(r.key)}
              className="chip w-full justify-between text-left"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 border border-black/30" style={{ backgroundColor: r.color }} />
                <span className="truncate">{r.label}</span>
              </span>
              {on && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
      <Button variant="ghost" onClick={reset} block>
        <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
      </Button>
    </Card>
  );
}

function MuscleTargetsEditor() {
  const { targets, set, reset } = useMuscleTargets();
  const { tracked } = useTrackedMuscles();
  // Only show targets for muscles the user actually tracks
  const visibleRows = ALL_MUSCLE_ROWS.filter((r) => tracked.includes(r.key));
  const step = "flex h-9 w-9 items-center justify-center border border-line text-sm font-bold text-ink-2 transition-colors hover:text-ink";
  return (
    <Card variant="flat" className="space-y-3 p-4">
      <Section icon={<Target className="h-3.5 w-3.5" />} title="Weekly muscle targets">
        <p className="text-sm text-ink-2">
          Working sets per muscle per week. Tap a number to edit. Add muscles above to set their targets.
        </p>
      </Section>
      <ul className="divide-y divide-line-soft border-y border-line-soft">
        {visibleRows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 py-2">
            <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: r.color }} />
            <span className="flex-1 text-sm font-semibold">{r.label}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => set(r.key as DisplayMuscle, targets[r.key as DisplayMuscle] - 1)}
                aria-label={`Decrease ${r.label}`}
                className={step}
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={targets[r.key as DisplayMuscle]}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (Number.isFinite(n)) set(r.key as DisplayMuscle, n);
                }}
                aria-label={`${r.label} weekly sets`}
                className="box-input num h-9 min-h-0 w-12 text-center font-bold"
              />
              <button
                type="button"
                onClick={() => set(r.key as DisplayMuscle, targets[r.key as DisplayMuscle] + 1)}
                aria-label={`Increase ${r.label}`}
                className={step}
              >
                +
              </button>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="ghost" onClick={reset} block>
        <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
      </Button>
    </Card>
  );
}

function Tabs<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
