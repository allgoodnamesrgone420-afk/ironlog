import { z } from "zod";

/** Server-side validation for all writes. Same shapes mirrored in firestore.rules. */

export const WorkoutSetSchema = z.object({
  id: z.string().min(1).max(64),
  kg: z.number().finite().min(0).max(1000),
  reps: z.number().int().min(0).max(1000),
  rpe: z.number().min(0).max(10).optional(),
  warmup: z.boolean().optional(),
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
  // Room for the workout builder's context (recent sessions, top sets, memory).
  prompt: z.string().min(1).max(8_000),
  systemInstruction: z.string().max(8_000).default("You are a helpful assistant."),
  jsonMode: z.boolean().optional().default(false),
});

/** Streaming coach chat: the last few turns plus a data digest built on the device. */
export const CoachStreamSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "model"]), text: z.string().min(1).max(6_000) }))
    .min(1)
    .max(16),
  context: z.string().max(12_000).default(""),
});

export type WorkoutInput = z.infer<typeof WorkoutSchema>;
export type GeminiRequest = z.infer<typeof GeminiRequestSchema>;
