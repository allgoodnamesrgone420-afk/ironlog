"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { subscribeToWorkouts } from "@/lib/firebase/repository";
import type { Workout } from "@/types/workout";

export function useWorkouts() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setWorkouts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToWorkouts(user.uid, (w) => {
      setWorkouts(w);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  return { workouts, loading };
}
