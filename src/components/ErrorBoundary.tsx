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
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <span
          className="plunk face-over mb-6 flex h-14 w-14 items-center justify-center"
          style={{ ["--d" as string]: "5px" }}
          aria-hidden
        >
          <AlertTriangle className="h-7 w-7" />
        </span>
        <p className="label">Error</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Something broke</h1>
        <p className="mt-2 max-w-sm text-sm text-ink-2">
          The app hit an unexpected error. Your data is safe — try reloading.
        </p>
        <details className="mt-4 max-w-md text-xs text-ink-3">
          <summary className="cursor-pointer font-bold uppercase tracking-[0.1em]">Technical details</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words text-left">{this.state.error?.message}</pre>
        </details>
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" onClick={this.reset}>
            Try again
          </Button>
          <Button variant="lime" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}
