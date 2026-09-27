"use client";

import { useEffect, useState } from "react";
import { Scale, Plus } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useUnits } from "@/providers/UnitsProvider";
import { addBodyMetric, subscribeToBodyMetrics } from "@/lib/firebase/repository";
import { fromKg, toKg, formatWeight } from "@/lib/units/converter";
import type { BodyMetric } from "@/types/workout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { MiniChart, type ChartPoint } from "@/components/dashboard/MiniChart";

export default function BodyPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { units } = useUnits();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (!user) return;
    return subscribeToBodyMetrics(user.uid, (m) => {
      setMetrics(m);
      setLoaded(true);
    });
  }, [user]);

  const log = async () => {
    if (!user) return;
    const num = parseFloat(input.replace(",", "."));
    if (!Number.isFinite(num) || num <= 0 || num > 500) {
      toast.error("Enter a valid weight.");
      return;
    }
    try {
      await addBodyMetric(user.uid, { date: new Date(), weightKg: toKg(num, units) });
      setInput("");
      toast.success("Logged");
    } catch {
      toast.error("Couldn't save.");
    }
  };

  const chart: ChartPoint[] = metrics
    .filter((m) => typeof m.weightKg === "number")
    .slice(0, 30)
    .reverse()
    .map((m) => ({
      val: Number(fromKg(m.weightKg!, units).toFixed(1)),
      label: m.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      unit: units,
    }));

  return (
    <div className="stagger mx-auto max-w-[640px] space-y-5">
      <header style={{ ["--i" as string]: 0 }}>
        <p className="label">Body</p>
        <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">Body metrics</h1>
      </header>

      <Card className="p-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void log();
          }}
        >
          <label className="field min-w-0 flex-1">
            <span>Log bodyweight ({units})</span>
            <input
              type="text"
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Weight in ${units}`}
              className="num font-bold"
            />
          </label>
          <Button type="submit" variant="lime" className="shrink-0">
            <Plus className="h-5 w-5" /> Add
          </Button>
        </form>
      </Card>

      {!loaded ? (
        // Same shape as the trend card below.
        <div className="card space-y-3 p-4" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-[140px]" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        </div>
      ) : metrics.length > 0 ? (
        <Card className="p-4">
          <p className="label mb-3">Trend ({units})</p>
          <MiniChart data={chart} />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Latest" value={metrics[0]?.weightKg ? formatWeight(metrics[0].weightKg, units, 1) : "—"} />
            <Stat label="7-day Δ" value={changeOver(metrics, 7, units)} />
            <Stat label="30-day Δ" value={changeOver(metrics, 30, units)} />
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={<Scale className="h-6 w-6" />}
          title="No metrics yet"
          description="Log your bodyweight to see your trend."
        />
      )}
    </div>
  );
}

function changeOver(metrics: BodyMetric[], days: number, units: "kg" | "lb") {
  const latest = metrics[0]?.weightKg;
  if (typeof latest !== "number") return "—";
  const target = Date.now() - days * 86_400_000;
  const past = metrics.find((m) => m.date.getTime() <= target && typeof m.weightKg === "number");
  if (!past?.weightKg) return "—";
  const delta = latest - past.weightKg;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${fromKg(delta, units).toFixed(1)} ${units}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="label !text-[10px]">{label}</p>
      <p className="num mt-0.5 font-extrabold">{value}</p>
    </div>
  );
}
