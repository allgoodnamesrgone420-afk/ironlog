"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { Activity, LogOut, Moon, Plus, Sun } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { friendlyName } from "@/lib/utils";
import { SIDEBAR_TABS, isActive } from "./nav";

/** Desktop navigation (lg and up). Phones use the TopBar + BottomNav dock instead. */
export function Sidebar() {
  const { user } = useAuth();
  const { effective, setTheme } = useTheme();
  const pathname = usePathname();
  const name = friendlyName(user);

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <Link href="/dashboard" className="flex items-center gap-3 px-5 pb-6 pt-6">
        <span
          className="plunk face-lime flex h-10 w-10 items-center justify-center"
          style={{ ["--d" as string]: "4px" }}
          aria-hidden="true"
        >
          <Activity className="h-5 w-5" strokeWidth={2.75} />
        </span>
        <span className="text-2xl font-extrabold tracking-tight">IronLog</span>
      </Link>

      <div className="px-3 pb-5">
        <Link href="/log" className="pop-btn wide">
          <Plus className="h-4 w-4" strokeWidth={3} /> Log workout
        </Link>
      </div>

      <nav aria-label="Main" className="flex flex-col gap-1 px-3">
        {SIDEBAR_TABS.map((t) => {
          const active = isActive(pathname, t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 items-center gap-3 px-3 text-xs font-bold uppercase tracking-[0.1em] transition-colors ${
                active ? "bg-lime text-on-accent" : "text-ink-2 hover:bg-elevated hover:text-ink"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-line p-4">
        <Link href="/settings" className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center bg-violet text-lg font-extrabold text-on-accent"
            aria-hidden="true"
          >
            {name[0]}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{name}</span>
            {user?.email && <span className="block truncate text-[11px] text-ink-3">{user.email}</span>}
          </span>
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => setTheme(effective === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center border border-line text-ink-2 transition-colors hover:text-ink"
          >
            {effective === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => signOut(auth)}
            className="flex h-9 items-center gap-1.5 border border-line px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-2 transition-colors hover:text-ink"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
