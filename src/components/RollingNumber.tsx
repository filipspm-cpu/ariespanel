import { useEffect, useRef, useState } from "react";

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function RollingNumber({
  value,
  delay = 0,
  duration = 900,
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
  const current = useRef(0);

  useEffect(() => {
    if (!ready) return;
    if (played.current) {
      current.current = value;
      setShown(value);
      return;
    }
    played.current = true;
    let raf = 0;
    let finished = false;
    const ceiling = Math.max(24, Math.abs(value) * 4, 99);
    const scrambleUntil = duration * 0.62;
    const startAt = performance.now() + delay;
    let lastFlip = 0;
    let settleFrom: number | null = null;

    const tick = (now: number) => {
      if (now < startAt) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - startAt;
      if (elapsed < scrambleUntil) {
        if (now - lastFlip > 28) {
          lastFlip = now;
          const sign = value < 0 ? -1 : 1;
          current.current = sign * Math.floor(Math.random() * ceiling);
          setShown(current.current);
        }
        raf = requestAnimationFrame(tick);
        return;
      }
      if (settleFrom === null) settleFrom = current.current;
      const t = Math.min(1, (elapsed - scrambleUntil) / Math.max(90, duration - scrambleUntil));
      current.current = Math.round(settleFrom + (value - settleFrom) * easeOut(t));
      if (t >= 1) {
        current.current = value;
        finished = true;
      }
      setShown(current.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (!finished) played.current = false;
    };
  }, [ready, value, delay, duration]);

  return <>{format(shown)}</>;
}
