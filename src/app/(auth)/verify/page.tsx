"use client";

import { useState } from "react";
import Link from "next/link";
import { sendEmailVerification, signOut } from "firebase/auth";
import { Mail } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";

export default function VerifyPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [sending, setSending] = useState(false);

  const resend = async () => {
    if (!user) return;
    setSending(true);
    try {
      await sendEmailVerification(user);
      toast.success("Verification email sent");
    } catch {
      toast.error("Couldn't send right now. Try again in a minute.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell subtitle="One last step.">
      <div className="plunk face-card p-5" style={{ ["--d" as string]: "5px" }}>
        <span className="flex h-12 w-12 items-center justify-center bg-violet text-on-accent" aria-hidden>
          <Mail className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-xl font-extrabold tracking-tight">Verify your email</h2>
        <p className="mt-1 text-sm text-ink-2">
          We sent a verification link to <strong className="text-ink">{user?.email ?? "your inbox"}</strong>. Click it, then return here.
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <Link href="/dashboard" className="pop-btn lime wide">
          I&rsquo;ve verified — continue
        </Link>
        <Button variant="secondary" onClick={resend} loading={sending} block>
          Resend email
        </Button>
        <button
          onClick={() => signOut(auth)}
          className="mx-auto min-h-[44px] px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3 hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </AuthShell>
  );
}
