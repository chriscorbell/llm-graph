import { useEffect, useReducer, useRef, useState, type RefObject } from "react";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Eases a list of numbers toward `target` whenever it changes. With `snap`, jumps straight there. */
export function useTween(target: number[], duration = 700, snap = false): number[] {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  const key = target.join(",");

  useEffect(() => {
    const from = current.current;
    if (snap || reducedMotion() || from.length !== target.length) {
      current.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - (1 - t) ** 4;
      const next = target.map((v, i) => from[i] + (v - from[i]) * e);
      current.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, duration]);

  return snap ? target : value;
}

/**
 * Glides each keyed value toward its target, so one that jumps moves there instead.
 * New keys start at their target; keys that drop out keep their last value.
 */
export function useGlide(targets: Map<string, number>, tau = 90): Map<string, number> {
  const shown = useRef(new Map<string, number>());
  const present = useRef(new Set<string>());
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  for (const [id, t] of targets) if (!present.current.has(id)) shown.current.set(id, t);
  present.current = new Set(targets.keys());
  const settled = [...targets].every(([id, t]) => Math.abs(shown.current.get(id)! - t) < 0.5);

  useEffect(() => {
    if (settled) return;
    const start = performance.now();
    const raf = requestAnimationFrame((now) => {
      const k = reducedMotion() ? 1 : 1 - Math.exp(-(now - start) / tau);
      for (const [id, t] of targets) {
        const v = shown.current.get(id)!;
        shown.current.set(id, Math.abs(t - v) < 0.5 ? t : v + (t - v) * k);
      }
      rerender();
    });
    return () => cancelAnimationFrame(raf);
  });

  return shown.current;
}

/** Keeps removed items around for `exitMs` so they can animate out. */
export function usePresence<T extends { id: string }>(items: T[], exitMs = 260): { item: T; exiting: boolean }[] {
  const previous = useRef(new Map<string, T>());
  const leaving = useRef(new Map<string, { item: T; until: number }>());
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const ids = new Set(items.map((i) => i.id));
  const now = performance.now();
  for (const [id, item] of previous.current) {
    if (!ids.has(id) && !leaving.current.has(id)) leaving.current.set(id, { item, until: now + exitMs });
  }
  for (const id of ids) leaving.current.delete(id);
  previous.current = new Map(items.map((i) => [i.id, i]));

  useEffect(() => {
    if (leaving.current.size === 0) return;
    const timer = setTimeout(() => {
      const t = performance.now();
      for (const [id, { until }] of leaving.current) if (until <= t) leaving.current.delete(id);
      rerender();
    }, exitMs + 20);
    return () => clearTimeout(timer);
  });

  return [
    ...[...leaving.current.values()].map(({ item }) => ({ item, exiting: true })),
    ...items.map((item) => ({ item, exiting: false })),
  ];
}

export function useSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** Re-renders once web fonts are ready so text measurements are accurate. */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    document.fonts.ready.then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  return ready;
}
