"use client";

import { useEffect, useRef } from "react";

/** Sign out after this much user inactivity. */
export const IDLE_LOGOUT_MS = 60 * 60 * 1000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousedown",
  "mousemove",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
];

/**
 * Calls onIdle when the page has had no user activity for `timeoutMs`.
 * Also logs out if the tab was hidden longer than the idle window.
 */
export function useIdleTimeout(
  enabled: boolean,
  onIdle: () => void,
  timeoutMs: number = IDLE_LOGOUT_MS,
): void {
  const onIdleRef = useRef(onIdle);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let throttleUntil = 0;

    const schedule = () => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        onIdleRef.current();
      }, timeoutMs);
    };

    const markActive = () => {
      const now = Date.now();
      if (now < throttleUntil) {
        return;
      }
      throttleUntil = now + 1000;
      lastActivityRef.current = now;
      schedule();
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        onIdleRef.current();
        return;
      }
      schedule();
    };

    lastActivityRef.current = Date.now();
    schedule();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, timeoutMs]);
}
