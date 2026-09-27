# IronLog v2

A modern, secure rewrite of IronLog. Built with Next.js 15 (App Router), TypeScript, Tailwind, Firebase, and Google Gemini.

## What's new vs v1

**Security**
- Gemini API endpoint now requires a verified Firebase ID token, validates input with Zod, and rate-limits per user.
- Firestore Security Rules included and versioned.
- Strict Content Security Policy + standard hardening headers.
- All secrets server-side only; web env vars clearly separated with `NEXT_PUBLIC_` prefix.
- `.gitignore` explicitly excludes every `.env*` file.
- Email verification + password reset flow.
- Input validation on every write — no more NaN volumes.

**Features**
- Logger: pinned session bar (time, sets, volume, Finish), −/+ steppers on the plate grid, a separate complete button, warm-up sets and RPE per set (tap the set number), drag-to-reorder, supersets, finished exercises fold to one line
- Rest timer (auto-start on set complete, vibration on finish)
- Workout summary after Finish (time, volume, sets, records, muscles hit) with a shareable image card
- Edit past workouts; delete with Undo
- Exercise pages: history, best sets, best weight for 1-12 reps, estimated 1RM trend (Epley + Brzycki)
- Progressive overload prompts (last session pre-fill + "try X" suggestions)
- Weekly goal (training days) with a streak that forgives one missed week a month, and a weekly report card (ported from Bite)
- Muscle balance against weekly targets, per muscle
- Exercise library + autocomplete (prevents PR fragmentation)
- Plate calculator, imperial / metric toggle
- Programs (PPL, 5/3/1, nSuns or your own)
- Body: weight with a smoothed trend, body fat, measurements, progress photos (side-by-side compare)
- AI Coach: streamed replies, remembers your preferences, builds today's workout around the muscles that are behind and opens it in the logger
- AI workout builder that targets muscles you pick (or the ones behind this week)
- Settings sync across devices
- PWA — installable, works offline (writes queue and sync later)
- CSV + JSON export

**UI/UX**
- NeoPop ("CRED-style") design shared with the Bite calorie tracker: theme tokens, 3D "plunk" cards, pop buttons and boxed fields live in `src/app/globals.css`; phones get a top bar + bottom dock, desktop a sidebar
- Persistent dark mode (localStorage + system pref)
- iOS-safe FAB (`env(safe-area-inset-bottom)`)
- `inputMode="decimal"` / `"numeric"` for proper mobile keyboards
- Toast system replaces every `alert()` / `window.confirm()`
- Real loading skeletons
- ErrorBoundary wrapping the app shell
- Coach is a real bottom-nav tab
- Tap targets meet 44pt minimum
- Generic auth error messages (no email enumeration)

## Setup

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
# Fill in your Firebase + Gemini credentials. See .env.example for details.

# 3. Run
npm run dev
```

## Deploying

```bash
# Deploy security rules (one-time / on rule changes).
# Progress photos need the rules from this version (progressPhotos + progressPhotoData).
npm run deploy:rules

# Vercel handles the app. Set the env vars from .env.example in the Vercel project.
```

## Architecture

```
src/
├── app/                    Next.js App Router pages
│   ├── (auth)/             Login, signup, forgot, verify
│   ├── (app)/              Authenticated app shell
│   │   ├── dashboard       Today: week vs goal, program, routines
│   │   ├── log             Workout logger (timer, RPE, warm-ups, plate calc)
│   │   ├── workout         Summary + share card; /workout/edit edits a saved one
│   │   ├── exercise        One exercise: history, records, 1RM trend
│   │   ├── history         Past sessions, export
│   │   ├── stats           Muscle balance, volume, 1RM, PRs, calendar
│   │   ├── week            Weekly report card
│   │   ├── coach           AI chat (streaming, memory, build a workout)
│   │   ├── programs        Multi-week programs
│   │   ├── body            Weight trend, body fat, measurements, photos
│   │   └── settings        Goal, units, theme, bar, targets, account
│   └── api/                Server routes (gemini, coach stream, health)
├── components/             React UI
├── hooks/                  Reusable state hooks
├── lib/                    Business logic
│   ├── firebase            Client + Admin SDK
│   ├── ai                  Gemini client, prompts, workout builder, coach digest
│   ├── analytics           1RM, volume, PRs, goal streak, weekly report, weight trend
│   ├── data                Exercise library
│   ├── server              CORS + Gemini stream helpers for API routes
│   ├── workout             Exercise-list edits, logger hand-off
│   ├── units               kg/lb conversion
│   └── validation          Zod schemas
├── providers/              React context providers
└── types/                  Shared TypeScript types
```

## Migration from v1

Your v1 Firestore data lived under `artifacts/{appId}/users/{uid}/workouts/...`.
v2 uses `users/{uid}/workouts/...` directly. See `scripts/migrate.ts` (TODO) or
copy via the Firebase console.
