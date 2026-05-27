"use client";

import { useState } from "react";
import { signOut, sendPasswordResetEmail, deleteUser } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Scale, Palette, Mail, LogOut, AlertTriangle, Target } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useUnits } from "@/providers/UnitsProvider";
import { useToast } from "@/providers/ToastProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";

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
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Settings</h1>

      {/* Units */}
      <Card className="p-5">
        <Section icon={<Scale className="w-4 h-4" />} title="Units">
          <Tabs
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
      <Card className="p-5">
        <Section icon={<Palette className="w-4 h-4" />} title="Theme">
          <Tabs
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

      {/* Weekly goal (UI only — stored in profile in a real build) */}
      <Card className="p-5">
        <Section icon={<Target className="w-4 h-4" />} title="Weekly goal">
          <p className="text-sm text-zinc-500">Currently fixed at 4 sessions/week. Customizable goal coming soon.</p>
        </Section>
      </Card>

      {/* Account */}
      <Card className="p-5 space-y-3">
        <Section icon={<Mail className="w-4 h-4" />} title="Account">
          <div className="text-sm text-zinc-500 dark:text-zinc-400 break-all">{user?.email}</div>
          {user && !user.emailVerified && (
            <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" /> Email not verified.
            </div>
          )}
        </Section>
        <Button variant="secondary" onClick={resetPassword} loading={resetting} className="w-full">
          Send password reset email
        </Button>
        <Button variant="secondary" onClick={() => signOut(auth)} className="w-full">
          <LogOut className="w-4 h-4" /> Sign out
        </Button>
        <Confirm
          title="Delete account?"
          message="This permanently removes your sign-in. Workout data deletion is handled separately by Firebase."
          confirmLabel="Delete"
          destructive
          onConfirm={deleteAccount}
          trigger={(open) => (
            <Button variant="ghost" onClick={open} className="w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
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
      <h2 className="font-bold text-zinc-700 dark:text-zinc-300 text-sm flex items-center gap-2">
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl flex">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors min-h-[40px] ${
            value === o.value
              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
