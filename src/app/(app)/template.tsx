import type { ReactNode } from "react";

/**
 * Re-mounts on every navigation, so each page fades in. Opacity only: a
 * transform here would become the containing block for fixed children like
 * the rest timer and pin them to the page instead of the screen.
 */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
