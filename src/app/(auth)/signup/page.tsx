"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { AuthShell, Field } from "@/components/auth/AuthShell";
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
      <h2 className="font-bold text-zinc-900 dark:text-white mb-6">Create account</h2>
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
        <Field
          label="Password"
          icon={<Lock className="w-5 h-5" />}
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        <Button type="submit" loading={loading} size="lg" className="w-full">
          Create account
        </Button>
      </form>
      <p className="text-xs text-zinc-500 mt-5 text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
