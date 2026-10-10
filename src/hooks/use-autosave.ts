"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "saved" | "dirty" | "saving" | "error";

/**
 * Tracks whether `value` differs from the last saved snapshot, autosaves after
 * a pause in typing, saves on ⌘S / Ctrl+S, and warns before leaving the page
 * with unsaved changes. `save` receives the value to persist.
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<void>, delayMs = 2000) {
  const serialized = JSON.stringify(value);
  const [savedSnapshot, setSavedSnapshot] = useState(serialized);
  const [state, setState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const latest = useRef({ value, serialized, save });
  latest.current = { value, serialized, save };

  const dirty = serialized !== savedSnapshot;

  const flush = useCallback(async (): Promise<boolean> => {
    // Wait for any in-flight save, then save again if still dirty.
    if (inFlight.current) await inFlight.current;
    const { value: v, serialized: snap, save: doSave } = latest.current;
    const run = (async () => {
      setState("saving");
      try {
        await doSave(v);
        setSavedSnapshot(snap);
        setSavedAt(new Date());
        setState(latest.current.serialized === snap ? "saved" : "dirty");
        return true;
      } catch (e) {
        console.error("[alimea] save failed", e);
        setState("error");
        return false;
      }
    })();
    inFlight.current = run;
    const ok = await run;
    inFlight.current = null;
    return ok;
  }, []);

  // Debounced autosave.
  useEffect(() => {
    if (!dirty) return;
    setState((s) => (s === "saving" ? s : "dirty"));
    const id = setTimeout(() => void flush(), delayMs);
    return () => clearTimeout(id);
  }, [serialized, dirty, delayMs, flush]);

  // ⌘S / Ctrl+S.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flush]);

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  /** Save now if needed; resolves true when everything is persisted. */
  const saveNow = useCallback(async () => {
    if (latest.current.serialized === savedSnapshot && !inFlight.current) return true;
    return flush();
  }, [flush, savedSnapshot]);

  return { state: dirty && state === "saved" ? "dirty" : state, dirty, savedAt, saveNow };
}
