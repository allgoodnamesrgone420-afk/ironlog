"use client";

import { useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import { parseSetTranscript } from "@/lib/voice/parser";
import { useToast } from "@/providers/ToastProvider";

interface Props {
  /** Called with kg + reps parsed from the user's voice. */
  onParsed: (set: { kg: number; reps: number }) => void;
}

export function VoiceButton({ onParsed }: Props) {
  const { supported, listening, transcript, start, stop } = useVoiceCapture();
  const toast = useToast();

  useEffect(() => {
    if (!transcript) return;
    const parsed = parseSetTranscript(transcript);
    if (parsed) {
      onParsed({ kg: parsed.kg, reps: parsed.reps });
      toast.success(`Logged ${parsed.kg.toFixed(1)} kg × ${parsed.reps}`);
    } else {
      toast.error(`Couldn't parse "${transcript}". Try "eighty kilos for eight reps".`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      aria-label={listening ? "Stop listening" : "Voice log this set"}
      className={`p-2 rounded-full transition-all min-w-[44px] min-h-[44px] flex items-center justify-center relative ${
        listening
          ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-brand-600"
      }`}
    >
      {listening ? (
        <>
          <MicOff className="w-4 h-4 relative z-10" />
          <span className="absolute inset-0 rounded-full bg-red-400/40 animate-pulse-ring" />
        </>
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </button>
  );
}
