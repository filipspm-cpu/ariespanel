import { useEffect, useRef, useState } from "react";

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function RollingNumber({
  value,
  delay = 0,
  duration = 1600,
  ready = true,
  format = (n) => Math.round(n).toLocaleString("pl-PL"),
}: {
  value: number;
  delay?: number;
  duration?: number;
  ready?: boolean;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(0);
  const played = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (played.current) {
      setShown(value);
      return;
    }
    played.current = true;
    let raf = 0;
    let finished = false;
    const startAt = performance.now() + delay;
    const span = Math.abs(value);
    const runMs = span <= 1 ? 480 : Math.min(duration, 850 + Math.min(span, 500) * 1.5);

    const tick = (now: number) => {
      if (now < startAt) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, (now - startAt) / runMs);
      const next = Math.round(value * easeOut(t));
      setShown(next);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      setShown(value);
      finished = true;
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (!finished) played.current = false;
    };
  }, [ready, value, delay, duration]);

  return <>{format(shown)}</>;
}
