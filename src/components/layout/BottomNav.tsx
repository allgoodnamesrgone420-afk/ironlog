"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History as HistoryIcon, Plus, Bot, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/history", icon: HistoryIcon, label: "History" },
  { href: "/coach", icon: Bot, label: "Coach" },
  { href: "/stats", icon: BarChart3, label: "Stats" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="max-w-md mx-auto bg-white/85 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800/80 rounded-2xl shadow-2xl px-2 py-1.5 grid grid-cols-5 items-center">
        {tabs.slice(0, 2).map((t) => (
          <NavTab key={t.href} {...t} active={pathname?.startsWith(t.href) ?? false} />
        ))}

        <div className="flex justify-center">
          <Link
            href="/log"
            aria-label="Log workout"
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-2xl text-white shadow-lg transition-transform",
              "bg-gradient-to-br from-brand-500 to-brand-700",
              pathname === "/log" ? "scale-110" : "hover:scale-105",
            )}
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </Link>
        </div>

        {tabs.slice(2).map((t) => (
          <NavTab key={t.href} {...t} active={pathname?.startsWith(t.href) ?? false} />
        ))}
      </div>
    </div>
  );
}

function NavTab({ href, icon: Icon, label, active }: { href: string; icon: typeof Home; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-0.5 py-2 rounded-xl transition-colors",
        active ? "text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
      )}
    >
      <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
      <span className="text-[10px] font-bold tracking-wide">{label}</span>
    </Link>
  );
}
