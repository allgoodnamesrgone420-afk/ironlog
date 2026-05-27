"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface Props {
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** Replaces window.confirm() with a proper, themable modal. */
export function Confirm({ trigger, title, message, confirmLabel = "Confirm", destructive, onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {trigger(() => setOpen(true))}
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <div className="p-5 space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{message}</p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={destructive ? "danger" : "primary"} onClick={handle} loading={busy}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
