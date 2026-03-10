"use client";

import { useEffect, useRef } from "react";

const RETRY_KEY = "style-health-retried";

export function StyleHealthGuard() {
  const probeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;

    const checkStylesLoaded = () => {
      const display = window.getComputedStyle(probe).display;
      return display === "none";
    };

    const tryRecover = () => {
      if (checkStylesLoaded()) return;
      if (sessionStorage.getItem(RETRY_KEY) === "1") return;
      sessionStorage.setItem(RETRY_KEY, "1");
      window.location.reload();
    };

    const frame = window.requestAnimationFrame(() => {
      // Give the stylesheet a brief moment to apply before deciding to reload.
      window.setTimeout(tryRecover, 120);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <div ref={probeRef} className="hidden" aria-hidden />;
}

