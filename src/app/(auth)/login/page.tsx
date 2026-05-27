"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { AuthShell, Field } from "@/components/auth/AuthShell";
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
      <h2 className="font-bold text-zinc-900 dark:text-white mb-6">Sign in</h2>
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
          placeholder="••••••••"
          autoComplete="current-password"
          required
          minLength={6}
        />
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        <Button type="submit" loading={loading} size="lg" className="w-full">
          Sign in
        </Button>
      </form>
      <div className="mt-5 flex items-center justify-between text-sm">
        <Link href="/forgot" className="text-brand-600 hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          Create account →
        </Link>
      </div>
    </AuthShell>
  );
}
