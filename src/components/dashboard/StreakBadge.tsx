import { Flame } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface Props {
  weeks: number;
  weeklyCount: number;
  weeklyGoal: number;
}

export function StreakBadge({ weeks, weeklyCount, weeklyGoal }: Props) {
  const pct = Math.min(1, weeklyGoal > 0 ? weeklyCount / weeklyGoal : 0);
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className="relative w-14 h-14 shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="currentColor"
            className="text-brand-500"
            strokeWidth="3"
            strokeDasharray={`${pct * 97.4} 97.4`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-zinc-900 dark:text-white">
          {weeklyCount}/{weeklyGoal}
        </div>
      </div>
      <div className="flex-1">
        <div className="text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider">This week</div>
        <div className="font-bold text-zinc-900 dark:text-white">{weeklyCount} sessions logged</div>
      </div>
      <div className="flex flex-col items-center bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-xl">
        <Flame className="w-5 h-5 text-amber-500" aria-hidden />
        <span className="text-xs font-bold text-amber-700 dark:text-amber-400 mt-0.5">{weeks}w</span>
      </div>
    </Card>
  );
}
