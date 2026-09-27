"use client";

import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { deleteWorkout, putWorkout } from "@/lib/firebase/repository";
import type { Workout } from "@/types/workout";

/** Deletes straight away and offers Undo, which puts the workout back exactly as it was (same id). */
export function useDeleteWorkout() {
  const { user } = useAuth();
  const toast = useToast();
  return async (w: Workout): Promise<boolean> => {
    if (!user) return false;
    try {
      await deleteWorkout(user.uid, w.id);
    } catch {
      toast.error("Couldn't delete. Try again.");
      return false;
    }
    toast.undo(`Deleted "${w.name}"`, () => {
      putWorkout(user.uid, w)
        .then(() => toast.success("Workout restored"))
        .catch(() => toast.error("Couldn't restore it."));
    });
    return true;
  };
}
