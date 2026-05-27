"use client";

import { LogOut, Moon, Sun, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useTheme } from "@/providers/ThemeProvider";

export function TopBar() {
  const { effective, setTheme } = useTheme();
  return (
    <nav
      className="sticky top-0 z-30 px-4 py-3 flex justify-end items-center bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <div className="flex items-center gap-1">
        <button
          onClick={() => setTheme(effective === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          className="p-2.5 min-w-[40px] min-h-[40px] rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
        >
          {effective === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <Link
          href="/settings"
          aria-label="Settings"
          className="p-2.5 min-w-[40px] min-h-[40px] rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors flex items-center justify-center"
        >
          <SettingsIcon className="w-4 h-4" />
        </Link>
        <button
          onClick={() => signOut(auth)}
          aria-label="Sign out"
          className="p-2.5 min-w-[40px] min-h-[40px] rounded-full text-zinc-600 dark:text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
