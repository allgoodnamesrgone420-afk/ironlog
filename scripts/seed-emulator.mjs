#!/usr/bin/env node
/**
 * Seeds the local Firebase emulators with a demo lifter and ~10 weeks of
 * push / pull / legs history, so every screen has something to show.
 *
 *   npm run emulators          # terminal 1
 *   npm run seed               # terminal 2 (re-run any time; it starts fresh)
 *
 * Sign in as demo@ironlog.test / ironlog-demo. Only talks to localhost and
 * refuses any project id that isn't a demo- one.
 */

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-ironlog";
if (!PROJECT.startsWith("demo-")) {
  console.error(`Refusing to seed "${PROJECT}": only demo- projects (emulator only).`);
  process.exit(1);
}
const AUTH = "http://127.0.0.1:9099";
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const EMAIL = "demo@ironlog.test";
const PASSWORD = "ironlog-demo";

async function call(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", authorization: "Bearer owner", ...init.headers },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${url} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** JS value → Firestore REST value. */
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  return { mapValue: { fields: fields(v) } };
}
const fields = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, enc(v)]));
const put = (path, data) => call(`${FS}/${path}`, { method: "PATCH", body: JSON.stringify({ fields: fields(data) }) });

let n = 0;
const id = () => `seed${(++n).toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// Deterministic jitter so re-seeding gives the same history.
let s = 7;
const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);

const DAYS = {
  Push: [
    ["Barbell Bench Press", 70, 5, 3, 2.5],
    ["Overhead Press", 42.5, 6, 3, 1.25],
    ["Incline Dumbbell Press", 24, 10, 3, 1],
    ["Lateral Raise", 10, 15, 3, 0.5],
    ["Tricep Pushdown", 25, 12, 3, 1.25],
  ],
  Pull: [
    ["Deadlift", 120, 5, 3, 5],
    ["Pull Up", 0, 8, 3, 0],
    ["Barbell Row", 60, 8, 3, 2.5],
    ["Face Pull", 20, 15, 3, 1],
    ["Barbell Curl", 30, 10, 3, 1.25],
  ],
  Legs: [
    ["Back Squat", 95, 5, 3, 2.5],
    ["Romanian Deadlift", 80, 8, 3, 2.5],
    ["Leg Press", 160, 10, 3, 5],
    ["Leg Curl", 40, 12, 3, 2.5],
    ["Standing Calf Raise", 60, 15, 3, 2.5],
  ],
};

function buildWorkout(kind, date, week) {
  const exercises = DAYS[kind].map(([name, base, reps, sets, inc]) => {
    const kg = base + inc * week;
    const list = [];
    if (kind !== "Pull" || name !== "Pull Up") {
      if (name === "Barbell Bench Press" || name === "Back Squat" || name === "Deadlift") {
        list.push({ id: id(), kg: Math.round(kg * 0.5 * 2) / 2, reps: 8, warmup: true, completed: true });
      }
    }
    for (let i = 0; i < sets; i++) {
      const r = Math.max(1, reps - (i === sets - 1 && rand() < 0.4 ? 1 : 0) + (week > 6 && rand() < 0.2 ? 1 : 0));
      list.push({ id: id(), kg, reps: name === "Pull Up" ? reps + Math.floor(week / 3) : r, completed: true, ...(i === sets - 1 ? { rpe: 8 + Math.round(rand() * 2) / 2 } : {}) });
    }
    return { id: id(), name, sets: list, restSec: kind === "Legs" ? 150 : 90 };
  });
  const volume = exercises.reduce(
    (a, e) => a + e.sets.filter((x) => !x.warmup).reduce((b, x) => b + x.kg * x.reps, 0),
    0,
  );
  return {
    name: `${kind} Day`,
    date,
    exercises,
    totalVolume: Math.round(volume),
    durationSec: 3000 + Math.round(rand() * 1800),
    notes: null,
    programRef: null,
  };
}

async function main() {
  // Fresh start: wipe both emulators for this project.
  await call(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  await call(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });

  const user = await call(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, displayName: "Alex", returnSecureToken: true }),
  });
  const uid = user.localId;
  await call(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
    method: "POST",
    body: JSON.stringify({ localId: uid, emailVerified: true }),
  });

  await put(`users/${uid}`, { uid, email: EMAIL, displayName: "Alex", units: "kg", theme: "system", weeklyGoal: 4 });

  // 10 weeks back to yesterday, 3-4 sessions a week, rotating push / pull / legs.
  const kinds = ["Push", "Pull", "Legs"];
  const today = new Date();
  today.setHours(18, 0, 0, 0);
  let k = 0;
  let count = 0;
  for (let back = 70; back >= 1; back--) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    const dow = d.getDay();
    if (![1, 2, 4, 6].includes(dow)) continue; // Mon Tue Thu Sat
    if (rand() < 0.12) continue; // the odd missed day
    const week = Math.floor((70 - back) / 7);
    const kind = kinds[k++ % 3];
    await put(`users/${uid}/workouts/${id()}`, buildWorkout(kind, d, week));
    count++;
  }

  // Bodyweight every few days, trending slowly down.
  for (let back = 63; back >= 0; back -= 3) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    d.setHours(8, 0, 0, 0);
    const kg = Math.round((82.4 - (63 - back) * 0.035 + (rand() - 0.5) * 0.8) * 10) / 10;
    await put(`users/${uid}/bodyMetrics/${id()}`, { date: d, weightKg: kg });
  }

  console.log(`Seeded ${count} workouts for ${EMAIL} / ${PASSWORD} (uid ${uid}).`);
}

main().catch((e) => {
  console.error(e.message);
  console.error("Is the emulator running? npm run emulators");
  process.exit(1);
});
