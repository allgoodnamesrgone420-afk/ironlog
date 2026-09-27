"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { AuthShell, Field, FormError } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/dashboard");
    } catch {
      // Never disclose which field was wrong — generic message blocks email enumeration.
      setError("Couldn't sign in. Check your email and password and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell subtitle="Track your progress, hit your goals.">
      <h2 className="label mb-3">Sign in</h2>
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
          placeholder="••••••••"
          autoComplete="current-password"
          required
          minLength={6}
        />
        {error && <FormError>{error}</FormError>}
        <Button type="submit" loading={loading} variant="lime" size="lg" block className="!mt-5">
          Sign in
        </Button>
      </form>
      <div className="mt-6 flex items-center justify-between gap-3 text-sm">
        <Link href="/forgot" className="font-semibold text-ink-2 hover:text-ink">
          Forgot password?
        </Link>
        <Link
          href="/signup"
          className="font-bold uppercase tracking-[0.1em] underline decoration-lime decoration-2 underline-offset-4"
        >
          Create account
        </Link>
      </div>
    </AuthShell>
  );
}
