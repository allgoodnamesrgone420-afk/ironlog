"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { Mail } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { AuthShell, Field } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Always show success — never disclose if an email exists.
      await sendPasswordResetEmail(auth, email).catch(() => {});
    } finally {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <AuthShell subtitle="We'll send you a reset link.">
      <h2 className="font-bold text-zinc-900 dark:text-white mb-6">Reset password</h2>
      {sent ? (
        <div className="text-sm text-zinc-700 dark:text-zinc-300">
          If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox and spam folder.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field
            label="Email"
            icon={<Mail className="w-5 h-5" />}
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <Button type="submit" loading={loading} size="lg" className="w-full">
            Send reset link
          </Button>
        </form>
      )}
      <p className="text-xs text-zinc-500 mt-5 text-center">
        <Link href="/login" className="text-brand-600 hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
