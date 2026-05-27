import { z } from "zod";

/** Server-side validation for all writes. Same shapes mirrored in firestore.rules. */

export const WorkoutSetSchema = z.object({
  id: z.string().min(1).max(64),
  kg: z.number().finite().min(0).max(1000),
  reps: z.number().int().min(0).max(1000),
  rpe: z.number().min(0).max(10).optional(),
  completed: z.boolean(),
});

export const ExerciseSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  notes: z.string().max(500).optional(),
  supersetId: z.string().nullable().optional(),
  settings: z
    .object({
      seat: z.string().max(40).optional(),
      incline: z.string().max(40).optional(),
    })
    .optional(),
  restSec: z.number().int().min(0).max(900).optional(),
  sets: z.array(WorkoutSetSchema).min(1).max(50),
});

export const WorkoutSchema = z.object({
  name: z.string().min(1).max(80),
  exercises: z.array(ExerciseSchema).min(1).max(50),
  totalVolume: z.number().min(0),
  durationSec: z.number().int().min(0).max(86_400).optional(),
  notes: z.string().max(2000).optional(),
});

export const GeminiRequestSchema = z.object({
  prompt: z.string().min(1).max(4_000),
  systemInstruction: z.string().max(8_000).default("You are a helpful assistant."),
  jsonMode: z.boolean().optional().default(false),
});

export type WorkoutInput = z.infer<typeof WorkoutSchema>;
export type GeminiRequest = z.infer<typeof GeminiRequestSchema>;
