import { BarChart3, Bot, CalendarRange, History, Home, Settings } from "lucide-react";

/** Main destinations: the phone dock shows these four around the Log button. */
export const TABS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/history", label: "History", icon: History },
  { href: "/coach", label: "Coach", icon: Bot },
  { href: "/stats", label: "Stats", icon: BarChart3 },
] as const;

/** The desktop sidebar also lists the pages phones reach from Home and the top bar. */
export const SIDEBAR_TABS = [
  ...TABS,
  { href: "/programs", label: "Programs", icon: CalendarRange },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export const isActive = (pathname: string | null, href: string) => pathname?.startsWith(href) ?? false;
