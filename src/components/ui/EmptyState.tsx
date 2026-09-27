import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div className={cn("card flex flex-col items-center justify-center border-dashed px-6 py-10 text-center", className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center bg-elevated text-ink-3">{icon}</div>
      <h3 className="font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
