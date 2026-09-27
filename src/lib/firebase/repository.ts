"use client";

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import type { Workout, WorkoutTemplate, BodyMetric, MuscleGroup } from "@/types/workout";
import type { CoachMessage } from "@/types/ai";
import type { UserProfile } from "@/types/user";
import type { Program, ProgramCursor } from "@/types/program";

/**
 * Firestore applies a write to the local cache straight away but only resolves
 * it once the server confirms, which never happens while offline, so awaiting
 * it left buttons spinning forever. Wait briefly for the confirmation, then
 * treat the write as queued: it syncs by itself when the connection returns.
 * Errors that arrive in time (e.g. security rules) still reject.
 */
export async function confirmOrQueue(write: Promise<unknown>, waitMs = 4000): Promise<"saved" | "queued"> {
  write.catch(() => {}); // a late failure has no one to report to; avoid an unhandled rejection
  if (typeof navigator !== "undefined" && !navigator.onLine) return "queued";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const queued = new Promise<"queued">((resolve) => {
    timer = setTimeout(() => resolve("queued"), waitMs);
  });
  try {
    return await Promise.race([write.then(() => "saved" as const), queued]);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Workouts ────────────────────────────────────────────────────────
function workoutsCol(uid: string) {
  return collection(db, "users", uid, "workouts");
}

export function subscribeToWorkouts(uid: string, cb: (workouts: Workout[]) => void): Unsubscribe {
  const q = query(workoutsCol(uid), orderBy("date", "desc"));
  return onSnapshot(q, (snap) => {
    const rows: Workout[] = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      const ts = data["date"];
      const date = ts instanceof Timestamp ? ts.toDate() : new Date();
      return {
        id: d.id,
        name: String(data["name"] ?? "Untitled"),
        date,
        exercises: (data["exercises"] as Workout["exercises"]) ?? [],
        totalVolume: Number(data["totalVolume"] ?? 0),
        durationSec: data["durationSec"] as number | undefined,
        notes: data["notes"] as string | undefined,
        programRef: (data["programRef"] as Workout["programRef"]) ?? undefined,
      };
    });
    cb(rows);
  });
}

/** Firestore fields for a workout (the id is the document id). */
function workoutFields(workout: Omit<Workout, "id" | "date"> & { date?: Date }) {
  return {
    name: workout.name,
    exercises: workout.exercises,
    totalVolume: workout.totalVolume,
    durationSec: workout.durationSec ?? null,
    notes: workout.notes ?? null,
    programRef: workout.programRef ?? null,
    date: workout.date ? Timestamp.fromDate(workout.date) : serverTimestamp(),
  };
}

/**
 * Saves a new workout. The id is made on the device, so the summary page can
 * open it straight away, even offline (the write syncs later).
 */
export async function saveWorkout(uid: string, workout: Omit<Workout, "id" | "date"> & { date?: Date }) {
  const ref = doc(workoutsCol(uid));
  const status = await confirmOrQueue(setDoc(ref, workoutFields(workout)));
  return { id: ref.id, status };
}

/** Replaces a saved workout's contents (edit) or brings a deleted one back (undo). */
export async function putWorkout(uid: string, workout: Workout) {
  const { id, ...rest } = workout;
  return confirmOrQueue(setDoc(doc(workoutsCol(uid), id), workoutFields({ ...rest, date: rest.date })));
}

export async function deleteWorkout(uid: string, workoutId: string) {
  return confirmOrQueue(deleteDoc(doc(db, "users", uid, "workouts", workoutId)));
}

// ─── Custom exercises (user's personal library) ──────────────────────
export interface CustomExercise {
  /** Slug of the exercise name (used as doc id). */
  id: string;
  name: string;
  muscles: MuscleGroup[];
  createdAt: Date;
}

function customExercisesCol(uid: string) {
  return collection(db, "users", uid, "exercises");
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function subscribeToCustomExercises(uid: string, cb: (exs: CustomExercise[]) => void): Unsubscribe {
  return onSnapshot(customExercisesCol(uid), (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: String(data["name"] ?? d.id),
          muscles: (data["muscles"] as MuscleGroup[]) ?? [],
          createdAt: data["createdAt"] instanceof Timestamp ? (data["createdAt"] as Timestamp).toDate() : new Date(),
        };
      }),
    );
  });
}

/** Idempotent: upserts a custom exercise. Safe to call on every workout finish. */
export async function upsertCustomExercise(uid: string, name: string, muscles: MuscleGroup[]) {
  const id = slugify(name);
  if (!id) return;
  const ref = doc(customExercisesCol(uid), id);
  await setDoc(
    ref,
    {
      name: name.trim(),
      muscles,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteCustomExercise(uid: string, id: string) {
  return deleteDoc(doc(customExercisesCol(uid), id));
}

// ─── Templates ───────────────────────────────────────────────────────
export function templatesCol(uid: string) {
  return collection(db, "users", uid, "templates");
}

export function subscribeToTemplates(uid: string, cb: (t: WorkoutTemplate[]) => void): Unsubscribe {
  const q = query(templatesCol(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: String(data["name"] ?? "Untitled"),
          exercises: (data["exercises"] as WorkoutTemplate["exercises"]) ?? [],
          createdAt: data["createdAt"] instanceof Timestamp ? (data["createdAt"] as Timestamp).toDate() : new Date(),
        };
      }),
    );
  });
}

export async function saveTemplate(uid: string, template: Omit<WorkoutTemplate, "id" | "createdAt">) {
  return addDoc(templatesCol(uid), {
    name: template.name,
    exercises: template.exercises,
    createdAt: serverTimestamp(),
  });
}

export async function deleteTemplate(uid: string, id: string) {
  return deleteDoc(doc(db, "users", uid, "templates", id));
}

// ─── Body metrics ────────────────────────────────────────────────────
export function bodyMetricsCol(uid: string) {
  return collection(db, "users", uid, "bodyMetrics");
}

export function subscribeToBodyMetrics(uid: string, cb: (m: BodyMetric[]) => void): Unsubscribe {
  const q = query(bodyMetricsCol(uid), orderBy("date", "desc"));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const ts = data["date"];
        return {
          id: d.id,
          date: ts instanceof Timestamp ? ts.toDate() : new Date(),
          weightKg: data["weightKg"] as number | undefined,
          bodyFatPct: data["bodyFatPct"] as number | undefined,
          measurements: data["measurements"] as BodyMetric["measurements"],
          notes: data["notes"] as string | undefined,
        };
      }),
    ),
  );
}

// ─── Progress photos ─────────────────────────────────────────────────
// Two collections so the grid stays light: a small thumbnail per photo here,
// the full-size image in its own document, fetched only when opened.
export interface ProgressPhoto {
  id: string;
  date: Date;
  /** Small JPEG data URL for the grid. */
  thumb: string;
  note?: string;
}

function photosCol(uid: string) {
  return collection(db, "users", uid, "progressPhotos");
}
function photoDataDoc(uid: string, id: string) {
  return doc(db, "users", uid, "progressPhotoData", id);
}

export function subscribeToPhotos(uid: string, cb: (p: ProgressPhoto[]) => void, onError?: (e: Error) => void): Unsubscribe {
  const q = query(photosCol(uid), orderBy("date", "desc"));
  return onSnapshot(
    q,
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            date: data["date"] instanceof Timestamp ? (data["date"] as Timestamp).toDate() : new Date(),
            thumb: String(data["thumb"] ?? ""),
            note: (data["note"] as string | undefined) ?? undefined,
          };
        }),
      ),
    (e) => onError?.(e),
  );
}

export async function addPhoto(uid: string, photo: { date: Date; thumb: string; full: string; note?: string }) {
  const ref = doc(photosCol(uid));
  const batch = writeBatch(db);
  batch.set(ref, { date: Timestamp.fromDate(photo.date), thumb: photo.thumb, note: photo.note ?? null });
  batch.set(photoDataDoc(uid, ref.id), { full: photo.full });
  return confirmOrQueue(batch.commit());
}

/** The full-size image, or null if it's gone. */
export async function getPhotoFull(uid: string, id: string): Promise<string | null> {
  const snap = await getDoc(photoDataDoc(uid, id));
  const full = snap.exists() ? (snap.data() as Record<string, unknown>)["full"] : null;
  return typeof full === "string" ? full : null;
}

export async function deletePhoto(uid: string, id: string) {
  const batch = writeBatch(db);
  batch.delete(doc(photosCol(uid), id));
  batch.delete(photoDataDoc(uid, id));
  return confirmOrQueue(batch.commit());
}

export async function addBodyMetric(uid: string, metric: Omit<BodyMetric, "id">) {
  return confirmOrQueue(
    addDoc(bodyMetricsCol(uid), {
      ...metric,
      date: Timestamp.fromDate(metric.date),
    }),
  );
}

// ─── Coach chat ──────────────────────────────────────────────────────
export function coachCol(uid: string) {
  return collection(db, "users", uid, "coachChats");
}

export function subscribeToCoachMessages(uid: string, cb: (msgs: CoachMessage[]) => void): Unsubscribe {
  const q = query(coachCol(uid), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const ts = data["createdAt"];
        return {
          id: d.id,
          role: (data["role"] as "user" | "model") ?? "model",
          text: String(data["text"] ?? ""),
          createdAt: ts instanceof Timestamp ? ts.toDate() : new Date(),
          workout: (data["workout"] as CoachMessage["workout"]) ?? undefined,
        };
      }),
    ),
  );
}

/** A fresh message id, so a streamed reply can be swapped for its saved copy without a flicker. */
export const newCoachMessageId = (uid: string) => doc(coachCol(uid)).id;

export async function appendCoachMessage(
  uid: string,
  role: "user" | "model",
  text: string,
  extra: { id?: string; workout?: CoachMessage["workout"] } = {},
) {
  const ref = extra.id ? doc(coachCol(uid), extra.id) : doc(coachCol(uid));
  return confirmOrQueue(setDoc(ref, { role, text, createdAt: serverTimestamp(), ...(extra.workout ? { workout: extra.workout } : {}) }));
}

// ─── User profile (units, theme, weekly goal) ────────────────────────
export function profileDoc(uid: string) {
  return doc(db, "users", uid);
}

export async function upsertProfile(uid: string, patch: Partial<UserProfile>) {
  return setDoc(profileDoc(uid), patch, { merge: true });
}

export function subscribeToProfile(uid: string, cb: (p: Partial<UserProfile> | null) => void): Unsubscribe {
  return onSnapshot(profileDoc(uid), (snap) => {
    cb(snap.exists() ? (snap.data() as Partial<UserProfile>) : null);
  });
}

// ─── Programs / mesocycles ───────────────────────────────────────────
export function programsCol(uid: string) {
  return collection(db, "users", uid, "programs");
}

export function subscribeToPrograms(uid: string, cb: (p: Program[]) => void): Unsubscribe {
  const q = query(programsCol(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: String(data["name"] ?? "Untitled program"),
          description: data["description"] as string | undefined,
          weeks: (data["weeks"] as Program["weeks"]) ?? [],
          trainingMaxes: (data["trainingMaxes"] as Program["trainingMaxes"]) ?? {},
          active: Boolean(data["active"]),
          cursor: (data["cursor"] as ProgramCursor) ?? { week: 0, day: 0 },
          createdAt: data["createdAt"] instanceof Timestamp ? (data["createdAt"] as Timestamp).toDate() : new Date(),
        };
      }),
    ),
  );
}

export async function saveProgram(
  uid: string,
  program: Omit<Program, "id" | "createdAt">,
) {
  return confirmOrQueue(
    addDoc(programsCol(uid), {
      name: program.name,
      description: program.description ?? null,
      weeks: program.weeks,
      trainingMaxes: program.trainingMaxes ?? {},
      active: program.active ?? false,
      cursor: program.cursor ?? { week: 0, day: 0 },
      createdAt: serverTimestamp(),
    }),
  );
}

export async function updateProgram(uid: string, id: string, patch: Partial<Program>) {
  return confirmOrQueue(updateDoc(doc(programsCol(uid), id), patch as Record<string, unknown>));
}

export async function deleteProgram(uid: string, id: string) {
  return confirmOrQueue(deleteDoc(doc(programsCol(uid), id)));
}

/** Make exactly one program active; all others are flipped inactive in a batch. */
export async function setActiveProgram(uid: string, id: string, allIds: string[]) {
  const batch = writeBatch(db);
  for (const pid of allIds) {
    batch.update(doc(programsCol(uid), pid), { active: pid === id });
  }
  return confirmOrQueue(batch.commit());
}

export async function advanceProgramCursor(uid: string, id: string, cursor: ProgramCursor) {
  return confirmOrQueue(updateDoc(doc(programsCol(uid), id), { cursor }));
}
