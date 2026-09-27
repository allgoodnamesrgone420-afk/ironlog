"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { AuthShell, Field, FormError } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { upsertProfile } from "@/lib/firebase/repository";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await Promise.all([
        sendEmailVerification(cred.user),
        upsertProfile(cred.user.uid, {
          uid: cred.user.uid,
          email: cred.user.email ?? email,
          units: "kg",
          theme: "system",
          weeklyGoal: 4,
          defaultRestSec: 120,
          barbellKg: 20,
          createdAt: new Date(),
        }),
      ]);
      router.replace("/verify");
    } catch {
      // Generic message also for sign-up: don't expose whether the email exists.
      setError("Couldn't create the account. Try a different email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell subtitle="Start logging in under 60 seconds.">
      <h2 className="label mb-3">Create account</h2>
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
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {error && <FormError>{error}</FormError>}
        <Button type="submit" loading={loading} variant="lime" size="lg" block className="!mt-5">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-ink underline decoration-lime decoration-2 underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
