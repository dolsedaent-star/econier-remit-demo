import { useSyncExternalStore } from "react";
import { TZ_TH, ymd } from "./format";

// 태국 화면과 한국 화면이 같은 브라우저의 localStorage를 공유한다.
// 한 창에서 쓰면 다른 창은 storage 이벤트로 바로 갱신된다 (서버 없음, 연출용)

export const RATES = {
  /** 1 ECONIER = 1 USD */
  usdThb: 33.42,
  usdKrw: 1385.2,
};

/** ECONIER 네트워크 수수료 (USD) */
export const NETWORK_FEE_USD = 0.04;

export type TransferStatus =
  | "processing" // 태국: 심사·환전·서명 중
  | "broadcast" // 네트워크에 전파됨 (한국: 수신 감지)
  | "confirmed" // 블록체인 장부 기록 완료
  | "credited" // 한국: 입금 확인 (KRW 환전)
  | "paid" // 한국: 고객에게 현금 지급
  | "transit"; // SWIFT: 중계은행 경유 중 (데모 시간 안에는 도착하지 않는다)

export type Transfer = {
  id: string;
  ref: string;
  createdAt: number;
  thb: number;
  econier: number;
  krw: number;
  remitter: { name: string; nameTh: string; account: string };
  beneficiary: { name: string; nameKo: string; account: string; phone: string };
  purpose: string;
  status: TransferStatus;
  /** 없으면 ECONIER */
  channel?: "swift";
  /** SWIFT 도착 예정 (가장 빠른 날, 가장 늦은 날) */
  eta?: [number, number];
  txHash?: string;
  block?: number;
  confirmations?: number;
  confirmedAt?: number;
  creditedAt?: number;
  paidAt?: number;
};

type DemoState = { transfers: Transfer[] };

const KEY = "econier-demo-v1";
const EMPTY: DemoState = { transfers: [] };

let cache: DemoState = load();
const listeners = new Set<() => void>();

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DemoState) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

window.addEventListener("storage", (e) => {
  if (e.key !== KEY && e.key !== null) return;
  cache = load();
  emit();
});

function write(next: DemoState) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장이 막혀도 같은 창 안에서는 계속 동작
  }
  emit();
}

export function useTransfers() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => cache.transfers,
  );
}

export function addTransfer(t: Transfer) {
  write({ transfers: [t, ...cache.transfers] });
}

export function updateTransfer(id: string, patch: Partial<Transfer>) {
  write({
    transfers: cache.transfers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  });
}

export function resetDemo() {
  write(EMPTY);
}

// ── 계산 ──────────────────────────────────────────

export function thbToEconier(thb: number) {
  return Math.floor((thb / RATES.usdThb) * 100) / 100;
}

/** 창구 현금 지급을 위해 10원 단위로 내림 */
export function econierToKrw(econier: number) {
  return Math.floor((econier * RATES.usdKrw) / 10) * 10;
}


// ── 체인 연출 ─────────────────────────────────────

/** 블록 높이는 시간으로 계산해 두 창이 같은 숫자를 본다 (3초에 한 블록) */
const CHAIN_EPOCH = Date.UTC(2026, 0, 1);
const BLOCK_BASE = 18_204_000;
export const BLOCK_MS = 3000;

export function blockAt(time = Date.now()) {
  return BLOCK_BASE + Math.floor((time - CHAIN_EPOCH) / BLOCK_MS);
}

export function randomHex(len: number) {
  const bytes = new Uint8Array(len / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function shortHash(hash: string, head = 8, tail = 6) {
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

// ── 자동 재생 모드 (창마다 따로) ─────────────────

export type Screen = "th" | "kr";

const autoKey = (screen: Screen) => `econier-demo-auto-${screen}`;
const autoListeners = new Set<() => void>();
const autoCache: Record<Screen, boolean> = { th: readAuto("th"), kr: readAuto("kr") };

function readAuto(screen: Screen) {
  try {
    return localStorage.getItem(autoKey(screen)) === "1";
  } catch {
    return false;
  }
}

// 런처에서 바꾼 값이 열려 있는 창에도 반영되게 한다
window.addEventListener("storage", (e) => {
  if (e.key !== autoKey("th") && e.key !== autoKey("kr")) return;
  autoCache.th = readAuto("th");
  autoCache.kr = readAuto("kr");
  autoListeners.forEach((l) => l());
});

export function setAutoMode(screen: Screen, on: boolean) {
  autoCache[screen] = on;
  try {
    localStorage.setItem(autoKey(screen), on ? "1" : "0");
  } catch {
    // 무시
  }
  autoListeners.forEach((l) => l());
}

export function useAutoMode(screen: Screen) {
  return useSyncExternalStore(
    (l) => {
      autoListeners.add(l);
      return () => autoListeners.delete(l);
    },
    () => autoCache[screen],
  );
}

// ── 기본 송금 당사자 ──────────────────────────────

export const REMITTER = { name: "SOMCHAI JAIDEE", nameTh: "สมชาย ใจดี", account: "012-3-45678-9" };
export const BENEFICIARY = { name: "KIM MINJUN", nameKo: "김민준", account: "110-482-339201", phone: "+82 10-****-5821" };

export function makeRef(now = Date.now()) {
  return `TH-ORM-${ymd(now, TZ_TH)}-${String(cache.transfers.length + 184).padStart(6, "0")}`;
}

// ── 태국 창 접속 여부 (한국 창 혼자 시연할 때 판단용) ─

const BEAT_KEY = "econier-demo-th-beat";

export function beatThai() {
  try {
    localStorage.setItem(BEAT_KEY, String(Date.now()));
  } catch {
    // 무시
  }
}

export function isThaiOnline() {
  try {
    return Date.now() - Number(localStorage.getItem(BEAT_KEY) ?? 0) < 4000;
  } catch {
    return false;
  }
}

/** 태국 창 없이 한국 창만 띄웠을 때, 태국에서 보낸 것처럼 송금을 흘려보낸다 */
export async function simulateIncoming(thb = 10000) {
  const id = randomHex(12);
  const econier = thbToEconier(thb);
  const createdAt = Date.now();
  addTransfer({
    id,
    ref: makeRef(createdAt),
    createdAt,
    thb,
    econier,
    krw: econierToKrw(econier),
    remitter: REMITTER,
    beneficiary: BENEFICIARY,
    purpose: "Family Support",
    status: "processing",
  });
  await wait(3200);
  updateTransfer(id, { status: "broadcast", txHash: randomHex(64) });
  await wait(1400);
  const block = blockAt();
  for (let c = 1; c <= 3; c++) {
    await wait(1000);
    updateTransfer(id, { block, confirmations: c });
  }
  await wait(700);
  updateTransfer(id, { status: "confirmed", confirmedAt: Date.now() });
}

/** 주말을 건너뛰고 영업일 n일 뒤 */
export function addBusinessDays(time: number, n: number) {
  const d = new Date(time);
  while (n > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n--;
  }
  return d.getTime();
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
