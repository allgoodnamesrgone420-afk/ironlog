"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
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
      <h2 className="label mb-3">Reset password</h2>
      {sent ? (
        <div className="card border-l-[6px] border-l-ok p-4 text-sm">
          If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox and spam folder.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <Button type="submit" loading={loading} variant="lime" size="lg" block className="!mt-5">
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-ink-2 hover:text-ink">
          ← Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
