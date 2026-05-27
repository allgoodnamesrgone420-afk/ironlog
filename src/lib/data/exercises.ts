import type { ExerciseDefinition } from "@/types/workout";

/**
 * Curated exercise library. Used for:
 *  - Autocomplete in the logger (prevents PR-fragmentation typos)
 *  - Muscle-group tagging for the body heatmap
 *  - AI coach context
 */
export const EXERCISE_LIBRARY: ExerciseDefinition[] = [
  // Chest
  { name: "Barbell Bench Press", aliases: ["bench", "bb bench", "flat bench"], primary: ["chest"], secondary: ["triceps", "shoulders"], equipment: "barbell" },
  { name: "Incline Bench Press", aliases: ["incline bench"], primary: ["chest"], secondary: ["shoulders", "triceps"], equipment: "barbell" },
  { name: "Dumbbell Bench Press", aliases: ["db bench", "dumbbell press"], primary: ["chest"], secondary: ["triceps", "shoulders"], equipment: "dumbbell" },
  { name: "Incline Dumbbell Press", aliases: ["incline db"], primary: ["chest"], secondary: ["shoulders", "triceps"], equipment: "dumbbell" },
  { name: "Chest Fly", aliases: ["pec fly", "fly"], primary: ["chest"], equipment: "machine" },
  { name: "Cable Crossover", aliases: ["crossover"], primary: ["chest"], equipment: "cable" },
  { name: "Push Up", aliases: ["pushup"], primary: ["chest"], secondary: ["triceps", "core"], equipment: "bodyweight" },
  { name: "Dip", aliases: ["chest dip"], primary: ["chest"], secondary: ["triceps"], equipment: "bodyweight" },

  // Back
  { name: "Deadlift", aliases: ["dl", "conventional deadlift"], primary: ["back", "hamstrings", "glutes"], secondary: ["forearms", "core"], equipment: "barbell" },
  { name: "Barbell Row", aliases: ["bb row", "bent over row"], primary: ["back"], secondary: ["biceps", "forearms"], equipment: "barbell" },
  { name: "Pull Up", aliases: ["pullup"], primary: ["back"], secondary: ["biceps", "forearms"], equipment: "bodyweight" },
  { name: "Chin Up", aliases: ["chinup"], primary: ["back", "biceps"], equipment: "bodyweight" },
  { name: "Lat Pulldown", aliases: ["pulldown"], primary: ["back"], secondary: ["biceps"], equipment: "cable" },
  { name: "Seated Cable Row", aliases: ["cable row", "seated row"], primary: ["back"], secondary: ["biceps"], equipment: "cable" },
  { name: "T-Bar Row", aliases: ["t bar"], primary: ["back"], secondary: ["biceps"], equipment: "machine" },
  { name: "Face Pull", aliases: [], primary: ["back", "shoulders"], equipment: "cable" },

  // Shoulders
  { name: "Overhead Press", aliases: ["ohp", "shoulder press", "military press"], primary: ["shoulders"], secondary: ["triceps", "core"], equipment: "barbell" },
  { name: "Dumbbell Shoulder Press", aliases: ["db ohp", "db shoulder press"], primary: ["shoulders"], secondary: ["triceps"], equipment: "dumbbell" },
  { name: "Lateral Raise", aliases: ["side raise", "lat raise"], primary: ["shoulders"], equipment: "dumbbell" },
  { name: "Rear Delt Fly", aliases: ["reverse fly"], primary: ["shoulders"], equipment: "dumbbell" },
  { name: "Front Raise", aliases: [], primary: ["shoulders"], equipment: "dumbbell" },

  // Arms
  { name: "Barbell Curl", aliases: ["bb curl"], primary: ["biceps"], equipment: "barbell" },
  { name: "Dumbbell Curl", aliases: ["db curl"], primary: ["biceps"], equipment: "dumbbell" },
  { name: "Hammer Curl", aliases: [], primary: ["biceps", "forearms"], equipment: "dumbbell" },
  { name: "Preacher Curl", aliases: [], primary: ["biceps"], equipment: "machine" },
  { name: "Tricep Pushdown", aliases: ["pushdown"], primary: ["triceps"], equipment: "cable" },
  { name: "Skull Crusher", aliases: ["lying tricep ext", "skullcrusher"], primary: ["triceps"], equipment: "barbell" },
  { name: "Overhead Tricep Extension", aliases: ["overhead extension"], primary: ["triceps"], equipment: "dumbbell" },
  { name: "Tricep Dip", aliases: ["bench dip"], primary: ["triceps"], equipment: "bodyweight" },

  // Legs
  { name: "Back Squat", aliases: ["squat", "barbell squat"], primary: ["quads", "glutes"], secondary: ["hamstrings", "core"], equipment: "barbell" },
  { name: "Front Squat", aliases: ["fs"], primary: ["quads"], secondary: ["core", "glutes"], equipment: "barbell" },
  { name: "Romanian Deadlift", aliases: ["rdl"], primary: ["hamstrings", "glutes"], secondary: ["back"], equipment: "barbell" },
  { name: "Bulgarian Split Squat", aliases: ["bss", "split squat"], primary: ["quads", "glutes"], equipment: "dumbbell" },
  { name: "Leg Press", aliases: [], primary: ["quads", "glutes"], equipment: "machine" },
  { name: "Leg Extension", aliases: [], primary: ["quads"], equipment: "machine" },
  { name: "Leg Curl", aliases: ["hamstring curl"], primary: ["hamstrings"], equipment: "machine" },
  { name: "Hip Thrust", aliases: [], primary: ["glutes"], secondary: ["hamstrings"], equipment: "barbell" },
  { name: "Walking Lunge", aliases: ["lunge"], primary: ["quads", "glutes"], equipment: "dumbbell" },
  { name: "Standing Calf Raise", aliases: ["calf raise"], primary: ["calves"], equipment: "machine" },
  { name: "Seated Calf Raise", aliases: [], primary: ["calves"], equipment: "machine" },

  // Core
  { name: "Plank", aliases: [], primary: ["core"], equipment: "bodyweight" },
  { name: "Hanging Leg Raise", aliases: ["leg raise"], primary: ["core"], equipment: "bodyweight" },
  { name: "Cable Crunch", aliases: [], primary: ["core"], equipment: "cable" },
  { name: "Russian Twist", aliases: [], primary: ["core"], equipment: "bodyweight" },

  // Cardio
  { name: "Treadmill", aliases: ["run", "running"], primary: ["cardio"], equipment: "other" },
  { name: "Cycling", aliases: ["bike", "stationary bike"], primary: ["cardio"], equipment: "other" },
  { name: "Rowing", aliases: ["row machine"], primary: ["cardio", "back"], equipment: "machine" },
];

/**
 * Fuzzy match an exercise name against the library.
 * Used by autocomplete + analytics.
 */
export function findExercise(query: string): ExerciseDefinition | null {
  const q = query?.trim().toLowerCase();
  if (!q) return null;
  const exact = EXERCISE_LIBRARY.find((e) => e.name.toLowerCase() === q);
  if (exact) return exact;
  const alias = EXERCISE_LIBRARY.find((e) => e.aliases.some((a) => a.toLowerCase() === q));
  if (alias) return alias;
  const contains = EXERCISE_LIBRARY.find(
    (e) => e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q)),
  );
  return contains ?? null;
}

export function searchExercises(query: string, limit = 8): ExerciseDefinition[] {
  const q = query?.trim().toLowerCase();
  if (!q) return [];
  const starts = EXERCISE_LIBRARY.filter((e) => e.name.toLowerCase().startsWith(q));
  const contains = EXERCISE_LIBRARY.filter(
    (e) =>
      !e.name.toLowerCase().startsWith(q) &&
      (e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q))),
  );
  return [...starts, ...contains].slice(0, limit);
}
