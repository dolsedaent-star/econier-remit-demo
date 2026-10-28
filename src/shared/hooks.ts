import { useEffect, useState } from "react";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useLang<L extends string>(storageKey: string, fallback: L) {
  const [lang, setLang] = useState<L>(() => {
    try {
      return (localStorage.getItem(storageKey) as L | null) ?? fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, lang);
    } catch {
      // 무시
    }
  }, [storageKey, lang]);
  return [lang, setLang] as const;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
