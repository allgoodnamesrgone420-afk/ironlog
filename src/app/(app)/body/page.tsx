"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Columns2, ImageIcon, Plus, Ruler, Scale, Trash2 } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useUnits } from "@/providers/UnitsProvider";
import { useBodyMetrics } from "@/hooks/useBodyMetrics";
import { addBodyMetric, addPhoto, deletePhoto, getPhotoFull, subscribeToPhotos, type ProgressPhoto } from "@/lib/firebase/repository";
import { fromKg, toKg } from "@/lib/units/converter";
import { dayKey } from "@/lib/analytics/goal";
import { trendSeries, weeklyRate, weightsFromMetrics } from "@/lib/analytics/weight";
import { preparePhoto } from "@/lib/image";
import type { BodyMetric } from "@/types/workout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { WeightTrendChart } from "@/components/charts/WeightTrendChart";

type Site = keyof NonNullable<BodyMetric["measurements"]>;
const SITES: { key: Site; label: string }[] = [
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
  { key: "hips", label: "Hips" },
  { key: "arms", label: "Arms" },
  { key: "thighs", label: "Thighs" },
  { key: "neck", label: "Neck" },
];

const RANGES = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "all", label: "All", days: Infinity },
] as const;

const num = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function BodyPage() {
  const { units } = useUnits();
  const { metrics, loaded } = useBodyMetrics();
  // Lengths follow the weight units: centimetres with kg, inches with lb. Stored in cm.
  const len = units === "kg" ? "cm" : "in";
  const toCm = (v: number) => (len === "in" ? v * 2.54 : v);
  const fromCm = (v: number) => (len === "in" ? v / 2.54 : v);

  return (
    <div className="stagger mx-auto max-w-[640px] space-y-5">
      <header style={{ ["--i" as string]: 0 }}>
        <p className="label">Body</p>
        <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">Body metrics</h1>
      </header>

      <LogCard />
      {!loaded ? (
        <div className="card space-y-3 p-4" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          <WeightCard metrics={metrics} />
          <CompositionCard metrics={metrics} />
          <MeasurementsCard metrics={metrics} len={len} toCm={toCm} fromCm={fromCm} />
        </>
      )}
      <PhotosCard />
    </div>
  );
}

/* ------------------------------ log weight + body fat ------------------------------ */

function LogCard() {
  const { user } = useAuth();
  const toast = useToast();
  const { units } = useUnits();
  const [weight, setWeight] = useState("");
  const [fat, setFat] = useState("");
  const [saving, setSaving] = useState(false);

  const log = async () => {
    if (!user) return;
    const w = num(weight);
    const bf = num(fat);
    if (w === null && bf === null) return toast.error("Enter your weight, body fat, or both.");
    if (w !== null && (w < 20 || w > (units === "kg" ? 400 : 880))) return toast.error("Enter a valid weight.");
    if (bf !== null && (bf < 2 || bf > 70)) return toast.error("Body fat should be between 2 and 70%.");
    setSaving(true);
    try {
      await addBodyMetric(user.uid, {
        date: new Date(),
        ...(w !== null ? { weightKg: toKg(w, units) } : {}),
        ...(bf !== null ? { bodyFatPct: Math.round(bf * 10) / 10 } : {}),
      });
      setWeight("");
      setFat("");
      toast.success("Logged");
    } catch {
      toast.error("Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void log();
        }}
      >
        <label className="field min-w-0 flex-1">
          <span>Weight ({units})</span>
          <input type="text" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={units} className="num font-bold" />
        </label>
        <label className="field min-w-0 flex-1">
          <span>Body fat %</span>
          <input type="text" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="optional" className="num font-bold" />
        </label>
        <Button type="submit" variant="lime" loading={saving} className="shrink-0">
          <Plus className="h-5 w-5" /> Log
        </Button>
      </form>
    </Card>
  );
}

/* ------------------------------ weight trend ------------------------------ */

function WeightCard({ metrics }: { metrics: BodyMetric[] }) {
  const { units } = useUnits();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("90");
  const weights = useMemo(() => weightsFromMetrics(metrics), [metrics]);
  const today = dayKey(new Date());
  const series = useMemo(() => trendSeries(weights, today), [weights, today]);
  const rate = useMemo(() => weeklyRate(weights, today), [weights, today]);

  if (series.length === 0) {
    return (
      <EmptyState icon={<Scale className="h-6 w-6" />} title="No weigh-ins yet" description="Log your weight a few times a week and a smoothed trend appears here." />
    );
  }

  const days = RANGES.find((r) => r.key === range)!.days;
  const shown = Number.isFinite(days) ? series.slice(-days) : series;
  const latest = series[series.length - 1]!;
  const lastRaw = [...series].reverse().find((p) => p.kg !== null);

  return (
    <section className="plunk face-card p-4" style={{ ["--d" as string]: "4px" }} aria-label="Weight trend">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" /> Weight trend
          </p>
          <p className="num mt-1 text-3xl font-extrabold tracking-tight">
            {fromKg(latest.trend, units).toFixed(1)}
            <span className="ml-1 text-sm font-semibold text-ink-3">{units}</span>
          </p>
          <p className="num text-xs text-ink-2">
            {rate !== null
              ? `${rate > 0 ? "+" : rate < 0 ? "−" : "±"}${Math.abs(fromKg(rate, units)).toFixed(2)} ${units}/week over 4 weeks`
              : "A few more weigh-ins for a weekly rate"}
            {lastRaw && ` · last weigh-in ${fromKg(lastRaw.kg!, units).toFixed(1)}`}
          </p>
        </div>
      </div>
      <div className="segmented mb-3 mt-3" role="group" aria-label="Range">
        {RANGES.map((r) => (
          <button key={r.key} type="button" aria-pressed={range === r.key} onClick={() => setRange(r.key)}>
            {r.label}
          </button>
        ))}
      </div>
      {shown.length >= 2 ? (
        <WeightTrendChart series={shown} units={units} />
      ) : (
        <p className="py-6 text-center text-xs text-ink-3">One more weigh-in and the trend appears.</p>
      )}
      <p className="mt-3 text-[11px] text-ink-3">The trend smooths out day-to-day water swings, so it moves slower than the scale.</p>
    </section>
  );
}

/* ------------------------------ body fat ------------------------------ */

function CompositionCard({ metrics }: { metrics: BodyMetric[] }) {
  const { units } = useUnits();
  const fats = metrics.filter((m) => typeof m.bodyFatPct === "number" && m.bodyFatPct > 0);
  if (fats.length === 0) return null;
  const latest = fats[0]!;
  const monthAgo = Date.now() - 30 * 86_400_000;
  const past = fats.find((m) => m.date.getTime() <= monthAgo);
  const change = past ? latest.bodyFatPct! - past.bodyFatPct! : null;
  const weights = weightsFromMetrics(metrics);
  const series = trendSeries(weights, dayKey(new Date()));
  const trendKg = series[series.length - 1]?.trend;
  const leanKg = trendKg ? trendKg * (1 - latest.bodyFatPct! / 100) : null;

  return (
    <section className="grid grid-cols-2 gap-2" aria-label="Body composition">
      <div className="card p-3">
        <p className="label">Body fat</p>
        <p className="num mt-1 text-2xl font-extrabold">{latest.bodyFatPct!.toFixed(1)}%</p>
        <p className="num text-xs text-ink-2">
          {change !== null && Math.abs(change) >= 0.1 ? `${change > 0 ? "+" : "−"}${Math.abs(change).toFixed(1)} pts in 30 days` : latest.date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </p>
      </div>
      <div className="card p-3">
        <p className="label">Lean mass</p>
        <p className="num mt-1 text-2xl font-extrabold">
          {leanKg ? fromKg(leanKg, units).toFixed(1) : "—"}
          {leanKg && <span className="ml-1 text-xs font-semibold text-ink-3">{units}</span>}
        </p>
        <p className="num text-xs text-ink-2">{leanKg ? "trend weight × (1 − body fat)" : "log a weight too"}</p>
      </div>
    </section>
  );
}

/* ------------------------------ measurements ------------------------------ */

function MeasurementsCard({
  metrics,
  len,
  toCm,
  fromCm,
}: {
  metrics: BodyMetric[];
  len: "cm" | "in";
  toCm: (v: number) => number;
  fromCm: (v: number) => number;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Partial<Record<Site, string>>>({});
  const [saving, setSaving] = useState(false);

  // Newest and oldest value per site (metrics come newest first).
  const history = useMemo(() => {
    const out: Partial<Record<Site, { latest: number; first: number; date: Date }>> = {};
    for (const m of metrics) {
      for (const { key } of SITES) {
        const v = m.measurements?.[key];
        if (typeof v !== "number" || v <= 0) continue;
        const cur = out[key];
        if (!cur) out[key] = { latest: v, first: v, date: m.date };
        else cur.first = v;
      }
    }
    return out;
  }, [metrics]);

  const save = async () => {
    if (!user) return;
    const measurements: Partial<Record<Site, number>> = {};
    for (const { key } of SITES) {
      const v = num(draft[key] ?? "");
      if (v !== null) measurements[key] = Math.round(toCm(v) * 10) / 10;
    }
    if (Object.keys(measurements).length === 0) return toast.error("Enter at least one measurement.");
    setSaving(true);
    try {
      await addBodyMetric(user.uid, { date: new Date(), measurements });
      setDraft({});
      toast.success("Measurements saved");
    } catch {
      toast.error("Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-4" aria-label="Measurements">
      <p className="label flex items-center gap-1.5">
        <Ruler className="h-3.5 w-3.5" /> Measurements ({len})
      </p>
      <form
        className="mt-3 grid grid-cols-3 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {SITES.map(({ key, label }) => {
          const h = history[key];
          const delta = h ? fromCm(h.latest) - fromCm(h.first) : 0;
          return (
            <div key={key} className="min-w-0">
              <label className="field compact">
                <span>{label}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft[key] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((d) => ({ ...d, [key]: v }));
                  }}
                  placeholder={h ? fromCm(h.latest).toFixed(1) : len}
                  className="num font-bold"
                />
              </label>
              {h && Math.abs(delta) >= 0.1 && (
                <p className="num mt-0.5 text-[10px] text-ink-3">
                  {delta > 0 ? "+" : "−"}
                  {Math.abs(delta).toFixed(1)} since first
                </p>
              )}
            </div>
          );
        })}
        <div className="col-span-3 flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-ink-3">Measure first thing in the morning, same spot each time.</p>
          <Button type="submit" size="sm" loading={saving} className="shrink-0">
            Save
          </Button>
        </div>
      </form>
    </section>
  );
}

/* ------------------------------ progress photos ------------------------------ */

function PhotosCard() {
  const { user } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<ProgressPhoto | null>(null);
  const [comparing, setComparing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [pair, setPair] = useState<[ProgressPhoto, ProgressPhoto] | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    return subscribeToPhotos(
      user.uid,
      (p) => {
        setPhotos(p);
        setBlocked(false);
        setLoaded(true);
      },
      () => {
        setBlocked(true);
        setLoaded(true);
      },
    );
  }, [user, attempt]);

  // A refused listener never retries, and newly published rules can take a
  // minute to apply: keep checking while blocked, and when the app comes back.
  useEffect(() => {
    if (!blocked) return;
    const retry = () => {
      if (document.visibilityState === "visible") setAttempt((n) => n + 1);
    };
    const id = window.setInterval(retry, 15_000);
    document.addEventListener("visibilitychange", retry);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [blocked]);

  const add = async (file: File) => {
    if (!user) return;
    setAdding(true);
    try {
      const [full, thumb] = await Promise.all([preparePhoto(file, 1280, 900_000), preparePhoto(file, 360, 60_000)]);
      await addPhoto(user.uid, { date: new Date(), full, thumb });
      toast.success("Photo added");
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      toast.error(code === "not-an-image" ? "That file isn't a photo." : "Couldn't add the photo.");
    } finally {
      setAdding(false);
    }
  };

  const toggle = (p: ProgressPhoto) => {
    if (!comparing) return setOpen(p);
    const next = picked.includes(p.id) ? picked.filter((x) => x !== p.id) : [...picked, p.id].slice(-2);
    setPicked(next);
    if (next.length === 2) {
      const chosen = photos.filter((x) => next.includes(x.id)).sort((a, b) => a.date.getTime() - b.date.getTime());
      setPair([chosen[0]!, chosen[1]!]);
    }
  };

  return (
    <section className="card p-4" aria-label="Progress photos">
      <div className="flex items-center justify-between gap-2">
        <p className="label flex items-center gap-1.5">
          <Camera className="h-3.5 w-3.5" /> Progress photos
        </p>
        <div className="flex gap-2">
          {photos.length >= 2 && (
            <button
              type="button"
              aria-pressed={comparing}
              onClick={() => {
                setComparing((c) => !c);
                setPicked([]);
              }}
              className="chip min-h-8 px-2.5 text-xs"
            >
              <Columns2 className="h-3.5 w-3.5" /> Compare
            </button>
          )}
          <Button size="sm" onClick={() => fileRef.current?.click()} loading={adding} disabled={blocked}>
            <Plus className="h-4 w-4" /> Add
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void add(f);
            }}
          />
        </div>
      </div>
      {comparing && <p className="mt-2 text-xs text-ink-2">Pick two photos to see them side by side.</p>}

      {blocked ? (
        <div className="mt-3 border border-warn/60 bg-warn/10 p-3 text-xs">
          <p>
            Photos need the updated database rules (<code className="font-bold">firestore.rules</code>, see the README). Just published them? This clears by
            itself within a minute.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-2 font-bold uppercase tracking-[0.08em] underline decoration-2 underline-offset-4"
          >
            Check again
          </button>
        </div>
      ) : !loaded ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Skeleton className="aspect-[3/4]" />
          <Skeleton className="aspect-[3/4]" />
          <Skeleton className="aspect-[3/4]" />
        </div>
      ) : photos.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-1 border border-dashed border-line-soft px-4 py-8 text-center">
          <ImageIcon className="h-6 w-6 text-ink-3" />
          <p className="text-sm font-semibold">No photos yet</p>
          <p className="text-xs text-ink-2">Same pose, same light, every few weeks. They&apos;re private to your account.</p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p)}
              aria-pressed={comparing ? picked.includes(p.id) : undefined}
              aria-label={`Photo from ${p.date.toLocaleDateString()}`}
              className={`relative aspect-[3/4] overflow-hidden border ${picked.includes(p.id) ? "border-lime ring-2 ring-lime" : "border-line-soft"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL thumbnail */}
              <img src={p.thumb} alt="" className="h-full w-full object-cover" />
              <span className="num absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-0.5 text-left text-[10px] font-bold text-white">
                {p.date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" })}
              </span>
            </button>
          ))}
        </div>
      )}

      <PhotoViewer
        photo={open}
        onClose={() => setOpen(null)}
        onDelete={async (p) => {
          if (!user) return;
          setOpen(null);
          try {
            await deletePhoto(user.uid, p.id);
            toast.success("Photo deleted");
          } catch {
            toast.error("Couldn't delete it.");
          }
        }}
      />
      <CompareViewer
        pair={pair}
        onClose={() => {
          setPair(null);
          setPicked([]);
          setComparing(false);
        }}
      />
    </section>
  );
}

function useFullImage(photo: ProgressPhoto | null) {
  const { user } = useAuth();
  const [full, setFull] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!user || !photo) return;
    let live = true;
    getPhotoFull(user.uid, photo.id)
      .then((url) => live && setFull({ id: photo.id, url }))
      .catch(() => live && setFull({ id: photo.id, url: null }));
    return () => {
      live = false;
    };
  }, [user, photo]);
  // The thumbnail stands in until the full image arrives.
  return photo ? (full?.id === photo.id && full.url ? full.url : photo.thumb) : null;
}

function PhotoViewer({ photo, onClose, onDelete }: { photo: ProgressPhoto | null; onClose: () => void; onDelete: (p: ProgressPhoto) => void }) {
  const src = useFullImage(photo);
  return (
    <Modal open={photo !== null} onClose={onClose} title={photo?.date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}>
      <div className="space-y-4 px-5 pb-5 pt-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL from Firestore */}
        {src && <img src={src} alt="Progress photo" className="mx-auto max-h-[62dvh] w-auto" />}
        <Button variant="ghost" onClick={() => photo && onDelete(photo)} className="text-over hover:text-over">
          <Trash2 className="h-4 w-4" /> Delete photo
        </Button>
      </div>
    </Modal>
  );
}

function CompareViewer({ pair, onClose }: { pair: [ProgressPhoto, ProgressPhoto] | null; onClose: () => void }) {
  const a = useFullImage(pair?.[0] ?? null);
  const b = useFullImage(pair?.[1] ?? null);
  const weeks = pair ? Math.round((pair[1].date.getTime() - pair[0].date.getTime()) / (7 * 86_400_000)) : 0;
  return (
    <Modal open={pair !== null} onClose={onClose} title={weeks > 0 ? `${weeks} week${weeks === 1 ? "" : "s"} apart` : "Side by side"} className="lg:max-w-[760px]">
      <div className="grid grid-cols-2 gap-2 px-5 pb-5 pt-2">
        {pair?.map((p, i) => (
          <figure key={p.id}>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL from Firestore */}
            <img src={(i === 0 ? a : b) ?? p.thumb} alt={`Progress photo from ${p.date.toLocaleDateString()}`} className="aspect-[3/4] w-full object-cover" />
            <figcaption className="num mt-1 text-center text-xs font-bold">
              {p.date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            </figcaption>
          </figure>
        ))}
      </div>
    </Modal>
  );
}
