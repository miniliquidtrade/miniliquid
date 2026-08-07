import { cn } from "@/lib/format";

/**
 * Miniliquid wordmark lockup: the "mL" monogram (mini + liquid = milliliter)
 * next to the wordmark with the terminal "//". Monochrome — colour stays
 * reserved for P&L. Size is inherited from the parent's font-size.
 */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex select-none items-baseline gap-1.5", className)}>
      <span className="font-bold tracking-[-0.09em] text-term-hi">mL</span>
      <span className="tracking-tight text-term-fg">
        miniliquid<span className="text-term-dim">//</span>
      </span>
    </span>
  );
}
