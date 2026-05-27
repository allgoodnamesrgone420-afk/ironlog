import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-zinc-100 dark:bg-zinc-800 rounded-md animate-pulse",
        className,
      )}
    />
  );
}
