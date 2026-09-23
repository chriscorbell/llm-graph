import { useEffect, useReducer, useRef, useState, type RefObject } from "react";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Eases a list of numbers toward `target` whenever it changes. */
export function useTween(target: number[], duration = 700): number[] {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  const key = target.join(",");

  useEffect(() => {
    const from = current.current;
    if (reducedMotion() || from.length !== target.length) {
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

  return value;
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
