"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { TABS, isActive } from "./nav";

/** Sticky bottom dock on phones and tablets: four tabs around a one-thumb "Log" button. */
export function BottomNav() {
  const pathname = usePathname();
  const dockRef = useRef<HTMLDivElement>(null);

  // Publish the dock's real height so pages and the rest timer can clear it
  // (0 when the dock is hidden on desktop).
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty("--dock-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--dock-h");
    };
  }, []);

  const tab = (t: (typeof TABS)[number]) => {
    const active = isActive(pathname, t.href);
    const Icon = t.icon;
    return (
      <Link
        key={t.href}
        href={t.href}
        aria-current={active ? "page" : undefined}
        className={`flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
          active ? "bg-lime text-on-accent" : "text-ink-3 hover:text-ink"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2.2} />
        {t.label}
      </Link>
    );
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div ref={dockRef} className="mx-auto max-w-[430px] border-t border-line bg-bg/95 backdrop-blur-sm">
        <nav aria-label="Main" className="flex items-center gap-1 px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5">
          {TABS.slice(0, 2).map(tab)}
          <Link
            href="/log"
            aria-label="Log workout"
            aria-current={pathname === "/log" ? "page" : undefined}
            className="pop-btn h-11 min-h-0 flex-1 flex-col gap-0 px-0 text-[10px] tracking-[0.08em]"
            style={{ ["--d" as string]: "3px" }}
          >
            <Plus className="h-5 w-5" strokeWidth={3} />
            Log
          </Link>
          {TABS.slice(2).map(tab)}
        </nav>
      </div>
    </div>
  );
}
