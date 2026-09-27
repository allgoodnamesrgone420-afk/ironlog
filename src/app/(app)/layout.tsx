import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { PWARegister } from "@/components/PWARegister";
import { TimerProvider } from "@/providers/TimerProvider";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <TimerProvider>
        <div className="lg:flex">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <TopBar />
            <main className="mx-auto max-w-[430px] px-5 pb-[calc(var(--dock-h)_+_32px)] pt-5 lg:max-w-[1080px] lg:px-8 lg:pb-12 lg:pt-8">
              {children}
            </main>
          </div>
        </div>
        <BottomNav />
        <PWARegister />
      </TimerProvider>
    </AuthGate>
  );
}
