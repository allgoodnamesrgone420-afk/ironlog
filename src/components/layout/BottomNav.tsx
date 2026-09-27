"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { TABS, isActive } from "./nav";

/** Where the lime block sits; `jump` moves it without sliding (first show, resize). */
type Box = { x: number; y: number; w: number; h: number; jump: boolean };

/** Sticky bottom dock on phones and tablets: four tabs around a one-thumb "Log" button. */
export function BottomNav() {
  const pathname = usePathname();
  const dockRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<string, HTMLAnchorElement>());
  const activeHref = TABS.find((t) => isActive(pathname, t.href))?.href ?? null;
  const activeRef = useRef(activeHref);
  const prevActive = useRef<string | null>(null);
  const [box, setBox] = useState<Box | null>(null);

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

  // One lime block slides under the active tab instead of each tab lighting up.
  const measure = useCallback((jump: boolean) => {
    const href = activeRef.current;
    const el = href ? tabRefs.current.get(href) : undefined;
    if (!el) return;
    const next = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
    setBox((b) => (b && b.x === next.x && b.y === next.y && b.w === next.w && b.h === next.h ? b : { ...next, jump }));
  }, []);

  useLayoutEffect(() => {
    activeRef.current = activeHref;
    // Coming from a page without a tab (Log, Settings): appear in place, don't slide.
    if (activeHref) measure(prevActive.current === null);
    prevActive.current = activeHref;
  }, [activeHref, measure]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(() => measure(true));
    ro.observe(nav);
    return () => ro.disconnect();
  }, [measure]);

  const tab = (t: (typeof TABS)[number]) => {
    const active = t.href === activeHref;
    const Icon = t.icon;
    return (
      <Link
        key={t.href}
        href={t.href}
        ref={(el) => {
          if (el) tabRefs.current.set(t.href, el);
          else tabRefs.current.delete(t.href);
        }}
        aria-current={active ? "page" : undefined}
        className={`relative flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors duration-300 ${
          active ? "text-on-accent" : "text-ink-3 hover:text-ink"
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
        <nav
          ref={navRef}
          aria-label="Main"
          className="relative flex items-center gap-1 px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5"
        >
          {box && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute left-0 top-0 bg-lime ${
                box.jump
                  ? "transition-opacity duration-200"
                  : "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              }`}
              style={{
                width: box.w,
                height: box.h,
                transform: `translate(${box.x}px, ${box.y}px)`,
                opacity: activeHref ? 1 : 0,
              }}
            />
          )}
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
