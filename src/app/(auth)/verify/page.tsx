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
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mb-4">
          <Mail className="w-7 h-7 text-brand-600" />
        </div>
        <h2 className="font-bold text-zinc-900 dark:text-white text-lg">Verify your email</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          We sent a verification link to <strong>{user?.email ?? "your inbox"}</strong>. Click it, then return here.
        </p>
        <div className="flex flex-col gap-2 w-full mt-6">
          <Link href="/dashboard">
            <Button className="w-full">I&rsquo;ve verified — continue</Button>
          </Link>
          <Button variant="secondary" onClick={resend} loading={sending} className="w-full">
            Resend email
          </Button>
          <button
            onClick={() => signOut(auth)}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mt-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
