"use client";

import type { Position } from "@/lib/hl";

/**
 * Optimistic positions overlay.
 *
 * Hyperliquid takes a beat to reflect a fill in clearinghouseState, so a
 * freshly-opened position doesn't appear (and a closed one doesn't disappear)
 * until a refetch lands — which reads as lag. This tiny shared store lets the
 * UI reflect the user's own action immediately and reconcile once the real
 * data catches up:
 *   - addOpen: show a synthetic position right after the order signs.
 *   - addClose: hide a position the instant a full close signs.
 *   - reconcile: called with the real coins each time account data updates —
 *     clears an optimistic open once it's real, and an optimistic close once
 *     it's actually gone.
 * A safety timeout also clears each entry, so a silently-failed order can never
 * leave a phantom row stuck on screen.
 */

const SAFETY_MS = 15_000;

let opens: Record<string, Position> = {};
let closes: Record<string, true> = {};
let snap: { opens: Record<string, Position>; closes: Record<string, true> } = {
  opens,
  closes,
};

const listeners = new Set<() => void>();
const timers: Record<string, ReturnType<typeof setTimeout>> = {};

function commit() {
  snap = { opens, closes };
  listeners.forEach((l) => l());
}

function dropOpen(coin: string) {
  if (opens[coin]) {
    const next = { ...opens };
    delete next[coin];
    opens = next;
  }
}
function dropClose(coin: string) {
  if (closes[coin]) {
    const next = { ...closes };
    delete next[coin];
    closes = next;
  }
}
function safety(key: string, fn: () => void) {
  if (timers[key]) clearTimeout(timers[key]);
  timers[key] = setTimeout(fn, SAFETY_MS);
}

export const optimisticPositions = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  getSnapshot() {
    return snap;
  },
  /** Show a synthetic position immediately after an open order signs. */
  addOpen(pos: Position) {
    opens = { ...opens, [pos.coin]: pos };
    dropClose(pos.coin); // opening cancels any pending close
    safety(`open:${pos.coin}`, () => {
      dropOpen(pos.coin);
      commit();
    });
    commit();
  },
  /** Hide a position immediately after a full close signs. */
  addClose(coin: string) {
    closes = { ...closes, [coin]: true };
    dropOpen(coin); // closing cancels any pending open
    safety(`close:${coin}`, () => {
      dropClose(coin);
      commit();
    });
    commit();
  },
  /** Reconcile against the real position set from the latest account data. */
  reconcile(realCoins: Set<string>) {
    let changed = false;
    for (const coin of Object.keys(opens)) {
      if (realCoins.has(coin)) {
        dropOpen(coin);
        changed = true;
      }
    }
    for (const coin of Object.keys(closes)) {
      if (!realCoins.has(coin)) {
        dropClose(coin);
        changed = true;
      }
    }
    if (changed) commit();
  },
};
