import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
}

/**
 * Animates from previous value to new value over `durationMs` (default 600ms).
 * Uses easeOutQuart for a snappy "spring" feel.
 */
export function AnimatedNumber({ value, format, durationMs = 600 }: Props) {
  const [current, setCurrent] = useState(value);
  const startVal = useRef(value);
  const startTime = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === current) return;
    startVal.current = current;
    startTime.current = performance.now();
    const targetVal = value;

    const tick = (now: number) => {
      const elapsed = now - startTime.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart
      const v = startVal.current + (targetVal - startVal.current) * eased;
      setCurrent(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  const shown = Math.round(current);
  return <>{format ? format(shown) : shown}</>;
}
