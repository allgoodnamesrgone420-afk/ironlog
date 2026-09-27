"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { subscribeToBodyMetrics } from "@/lib/firebase/repository";
import type { BodyMetric } from "@/types/workout";

/** Weigh-ins, body fat and measurements, newest first. */
export function useBodyMetrics() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToBodyMetrics(user.uid, (m) => {
      setMetrics(m);
      setLoaded(true);
    });
  }, [user]);

  return { metrics, loaded };
}
