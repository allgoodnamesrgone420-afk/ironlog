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
import { MiniChart, type ChartPoint } from "@/components/dashboard/MiniChart";

export default function BodyPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { units } = useUnits();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (!user) return;
    return subscribeToBodyMetrics(user.uid, setMetrics);
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
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Body metrics</h1>

      <Card className="p-4">
        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Log bodyweight</label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Weight in ${units}`}
            className="flex-1 bg-zinc-50 dark:bg-zinc-800 rounded-xl px-4 py-3 text-base font-bold focus:ring-2 focus:ring-brand-500 outline-none"
          />
          <Button onClick={log} size="lg">
            <Plus className="w-5 h-5" /> Add
          </Button>
        </div>
      </Card>

      {metrics.length > 0 ? (
        <Card className="p-5">
          <h3 className="font-bold text-zinc-800 dark:text-white mb-3">Trend ({units})</h3>
          <MiniChart data={chart} color="#10b981" />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="Latest" value={metrics[0]?.weightKg ? formatWeight(metrics[0].weightKg, units, 1) : "—"} />
            <Stat
              label="7-day Δ"
              value={changeOver(metrics, 7, units)}
            />
            <Stat
              label="30-day Δ"
              value={changeOver(metrics, 30, units)}
            />
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={<Scale className="w-6 h-6" />}
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
    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3">
      <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{label}</div>
      <div className="font-bold text-zinc-900 dark:text-white mt-0.5">{value}</div>
    </div>
  );
}
