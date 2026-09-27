"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { ShellSkeleton } from "@/components/ui/PageSkeletons";

/**
 * Wraps protected pages. Redirects to /login when not signed in.
 * Renders a skeleton of the app frame during the auth check to avoid flashing the wrong UI.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) return <ShellSkeleton />;

  return <>{children}</>;
}
