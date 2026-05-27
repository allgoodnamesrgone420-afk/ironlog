"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/Button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Hook for a real error reporter (Sentry, etc.) here later.
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  override render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Something broke</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm">
          The app hit an unexpected error. Your data is safe — try reloading.
        </p>
        <details className="mt-4 text-xs text-zinc-400 max-w-md">
          <summary className="cursor-pointer">Technical details</summary>
          <pre className="mt-2 text-left whitespace-pre-wrap break-words">{this.state.error?.message}</pre>
        </details>
        <div className="flex gap-2 mt-6">
          <Button variant="secondary" onClick={this.reset}>
            Try again
          </Button>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    );
  }
}
