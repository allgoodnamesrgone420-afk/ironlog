import type { Config } from "tailwindcss";

/** A theme token from globals.css, with Tailwind opacity-modifier support. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sora)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        elevated: token("elevated"),
        /** Input background: page black in dark, white in light. */
        field: token("field-bg"),
        line: { DEFAULT: token("line"), soft: token("line-soft") },
        ink: { DEFAULT: token("ink"), 2: token("ink-2"), 3: token("ink-3") },
        ok: token("ok"),
        over: token("over"),
        under: token("under"),
        warn: token("warn"),
        // DEFAULT keeps Tailwind's numbered shades for these names.
        lime: { DEFAULT: token("lime") },
        violet: { DEFAULT: token("violet") },
        pink: { DEFAULT: token("pink") },
        blue: { DEFAULT: token("blue") },
        "on-accent": "#0d0d0d",
      },
    },
  },
  plugins: [],
};

export default config;
