import type { ReactNode } from "react";

/**
 * Re-mounts on every navigation, so each page fades and settles in. The
 * animation moves the page with a transform, which would trap fixed children,
 * so anything fixed inside a page (rest timer, sheets, Focus) portals to <body>.
 */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
