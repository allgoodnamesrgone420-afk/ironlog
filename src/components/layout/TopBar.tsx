"use client";

import { LogOut, Moon, Sun, Settings as SettingsIcon, Activity } from "lucide-react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { friendlyName } from "@/lib/utils";

const iconBtn =
  "flex h-10 w-10 shrink-0 items-center justify-center border border-line text-ink-2 transition-colors hover:text-ink";

/** Phones and tablets: who's signed in, theme, settings, sign out. Desktop uses the Sidebar. */
export function TopBar() {
  const { user } = useAuth();
  const { effective, setTheme } = useTheme();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm lg:hidden">
      <div className="mx-auto flex h-14 max-w-[430px] items-center gap-2 px-5">
        <Link
          href="/dashboard"
          className="plunk face-lime mr-1 flex h-8 w-8 shrink-0 items-center justify-center"
          style={{ ["--d" as string]: "3px" }}
          aria-label="IronLog, home"
        >
          <Activity className="h-4 w-4" strokeWidth={2.75} aria-hidden />
        </Link>
        <Link href="/settings" className="min-w-0 flex-1" aria-label="Your profile and settings">
          <p className="label leading-none">IronLog</p>
          <p className="truncate text-sm font-bold">Hi, {friendlyName(user)}</p>
        </Link>
        <button
          onClick={() => setTheme(effective === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          className={iconBtn}
        >
          {effective === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <Link href="/settings" aria-label="Settings" className={iconBtn}>
          <SettingsIcon className="h-4 w-4" />
        </Link>
        <button
          onClick={() => signOut(auth)}
          aria-label="Sign out"
          className="flex h-10 shrink-0 items-center gap-1.5 border border-line px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-2 transition-colors hover:text-ink"
        >
          <LogOut className="h-4 w-4" /> <span className="hidden min-[400px]:inline">Log out</span>
        </button>
      </div>
    </header>
  );
}
