"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Theme } from "@/types/user";

interface ThemeState {
  theme: Theme;
  effective: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const ThemeCtx = createContext<ThemeState>({
  theme: "system",
  effective: "light",
  setTheme: () => {},
});

const STORAGE_KEY = "ironlog:theme";

function systemPref(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(theme: Theme): "light" | "dark" {
  return theme === "system" ? systemPref() : theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [effective, setEffective] = useState<"light" | "dark">("light");
  // False until the stored preference is read. The inline script in the root
  // layout has already set the right class before paint, so don't touch it until
  // then (applying the "light" placeholder first made dark mode flash on load).
  const [loaded, setLoaded] = useState(false);

  // Initial load — runs once on mount
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage blocked: fall back to the system theme */
    }
    const initial: Theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setThemeState(initial);
    setEffective(resolve(initial));
    setLoaded(true);
  }, []);

  // Apply class to <html>, and match the browser/status bar to the page background
  useEffect(() => {
    if (!loaded || typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", effective === "dark");
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute("content", effective === "dark" ? "#0d0d0d" : "#f3f0e8"));
  }, [effective, loaded]);

  // React to system pref changes if theme === "system"
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setEffective(systemPref());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    setEffective(resolve(t));
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* private mode: still applies for this session */
    }
  };

  return <ThemeCtx.Provider value={{ theme, effective, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
