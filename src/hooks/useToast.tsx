"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { cn } from "@/lib/format";

interface Toast {
  id: number;
  kind: "ok" | "err";
  msg: string;
}

interface ToastCtx {
  notify: (kind: "ok" | "err", msg: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback(
    (kind: "ok" | "err", msg: string) => {
      const id = ++seq;
      setToasts((t) => [...t.slice(-3), { id, kind, msg }]);
      // Successes fade on their own; errors stay until dismissed.
      if (kind === "ok") setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-2 border border-term-line bg-term-panel px-3 py-2 text-[11px] text-term-fg shadow-sm"
          >
            <span className={cn("shrink-0", t.kind === "ok" ? "text-term-fg" : "text-term-mid")}>
              {t.kind === "ok" ? "✓" : "✕"}
            </span>
            <span className="min-w-0 flex-1 break-words">{t.msg}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-term-dim hover:text-term-fg"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
