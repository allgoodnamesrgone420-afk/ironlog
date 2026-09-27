import { Skeleton } from "./Skeleton";

/** Label + title lines that match a page header. */
function HeaderSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className={`h-7 ${wide ? "w-64" : "w-36"}`} />
    </div>
  );
}

/** A card row with a square glyph and two text lines (routines, history). */
function RowSkeleton() {
  return (
    <div className="card flex items-center gap-3 p-3">
      <Skeleton className="h-11 w-11 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      <Skeleton className="h-9 w-16 shrink-0" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between">
        <HeaderSkeleton />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
        <div className="space-y-5">
          <Skeleton className="h-[236px]" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-[92px]" />
            <Skeleton className="h-[92px]" />
            <Skeleton className="h-[92px]" />
          </div>
        </div>
        <div className="space-y-5">
          <Skeleton className="h-60" />
          <div className="space-y-3">
            <RowSkeleton />
            <RowSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton wide />
      <div className="grid grid-cols-[1.1fr_1fr] gap-3 lg:grid-cols-3">
        <Skeleton className="h-[150px]" />
        <div className="grid grid-rows-2 gap-2 lg:contents">
          <Skeleton className="h-full min-h-[70px]" />
          <Skeleton className="h-full min-h-[70px]" />
        </div>
      </div>
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export function HistorySkeleton() {
  return (
    <div className="mx-auto max-w-[640px] space-y-5" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
      <div className="space-y-4">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    </div>
  );
}

export function ProgramsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-40" />
      <RowSkeleton />
    </div>
  );
}

/** While sign-in is checked: the app's frame (top bar, content, dock) in grey. */
export function ShellSkeleton() {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-label="Loading">
      <div className="border-b border-line pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="mx-auto flex h-14 max-w-[430px] items-center gap-3 px-5">
          <Skeleton className="h-8 w-8" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
      <div className="mx-auto max-w-[430px] px-5 pt-5 lg:max-w-[1080px] lg:px-8 lg:pt-8">
        <DashboardSkeleton />
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg lg:hidden">
        <div className="mx-auto flex h-[60px] max-w-[430px] items-center gap-1 px-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 flex-1" />
          ))}
        </div>
      </div>
    </div>
  );
}
