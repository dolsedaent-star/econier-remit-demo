export function money(n: number, digits = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function int(n: number) {
  return Math.round(n).toLocaleString("en-US");
}

export const TZ_TH = "Asia/Bangkok";
export const TZ_KR = "Asia/Seoul";

export function clock(time: number, timeZone: string) {
  return new Date(time).toLocaleTimeString("en-GB", { timeZone, hour12: false });
}

/** 28-OCT-2026 (오라클 화면식 날짜) */
export function bizDate(time: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(time);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}-${get("month").toUpperCase()}-${get("year")}`;
}

/** 20261028 (참조번호용) */
export function ymd(time: number, timeZone: string) {
  return new Date(time).toLocaleDateString("en-CA", { timeZone }).replace(/-/g, "");
}

export function seconds(ms: number) {
  return (ms / 1000).toFixed(1);
}
