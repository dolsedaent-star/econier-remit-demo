import type { ReactNode } from "react";
import { BLOCK_MS, blockAt, setAutoMode, shortHash, useAutoMode, type Screen, type Transfer } from "./demo";
import { money } from "./format";
import { useNow } from "./hooks";

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 560,
  tone = "default",
}: {
  title: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  tone?: "default" | "econier";
}) {
  return (
    <div className="modal-backdrop">
      <div className={`modal modal--${tone}`} style={{ width }} role="dialog" aria-modal>
        <div className="modal__bar">
          <span className="modal__title">{title}</span>
          {onClose && (
            <button className="modal__x" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

export type StepState = "wait" | "active" | "done";

export function Steps({ items }: { items: { label: ReactNode; detail?: ReactNode; state: StepState }[] }) {
  return (
    <ol className="steps">
      {items.map((s, i) => (
        <li key={i} className={`step step--${s.state}`}>
          <span className="step__icon">
            {s.state === "done" ? "✓" : s.state === "active" ? <span className="spinner" /> : i + 1}
          </span>
          <span className="step__text">
            <span className="step__label">{s.label}</span>
            {s.detail && <span className="step__detail">{s.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function EconierMark({ size = 18 }: { size?: number }) {
  return <img src="/brand/token-mark.png" width={size} height={size} alt="" className="econier-mark" />;
}

export function EconierBadge() {
  return (
    <span className="econier-badge">
      <EconierMark size={14} />
      ECONIER
    </span>
  );
}

// ── 블록체인 장부 패널 (두 화면 공통, 탐색기 관례대로 영문) ─────────

export const NODE_TH = "TH-ISN-07";
export const NODE_KR = "KR-ISN-02";

const OTHER_NODES = ["SG-ISN-04", "VN-ISN-03", "PH-ISN-01", "JP-ISN-05", "MY-ISN-02", "ID-ISN-06", "KR-ISN-09", "TH-ISN-03"];

type Row = {
  hash: string;
  block: number | null;
  from: string;
  to: string;
  amount: number;
  status: "pending" | "finalized";
  time: number;
  ours: boolean;
};

function historicalRows(current: number, count: number): Row[] {
  const rows: Row[] = [];
  for (let b = current - 1; rows.length < count && b > current - 400; b--) {
    if (seed(b) > 0.42) continue;
    const from = OTHER_NODES[Math.floor(seed(b + 7) * OTHER_NODES.length)];
    let to = OTHER_NODES[Math.floor(seed(b + 13) * OTHER_NODES.length)];
    if (to === from) to = NODE_KR;
    rows.push({
      hash: randomHexSeeded(b),
      block: b,
      from,
      to,
      amount: Math.round((seed(b + 3) * 8000 + 40) * 100) / 100,
      status: "finalized",
      time: blockTime(b),
      ours: false,
    });
  }
  return rows;
}

/** 시드 기반 의사난수 — 장부의 과거 거래를 두 창에서 똑같이 만든다 */
function seed(n: number) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function randomHexSeeded(n: number) {
  let out = "";
  for (let i = 0; out.length < 64; i++) out += Math.floor(seed(n * 31 + i) * 16).toString(16);
  return out;
}

function blockTime(b: number) {
  const now = Date.now();
  return now - (blockAt(now) - b) * BLOCK_MS;
}

export function LedgerPanel({
  transfers,
  highlightId,
  title = "ECONIER Network · Public Ledger",
  rows: rowCount = 6,
}: {
  transfers: Transfer[];
  highlightId?: string;
  title?: string;
  rows?: number;
}) {
  const now = useNow(1000);
  const current = blockAt(now);

  const ours: Row[] = transfers
    .filter((t) => t.txHash)
    .map((t) => ({
      hash: t.txHash!,
      block: t.status === "broadcast" ? null : (t.block ?? null),
      from: NODE_TH,
      to: NODE_KR,
      amount: t.econier,
      status: t.status === "broadcast" ? "pending" : "finalized",
      time: t.confirmedAt ?? t.createdAt,
      ours: true,
    }));

  const rows = [...ours, ...historicalRows(current, rowCount)]
    .sort((a, b) => (b.block ?? Infinity) - (a.block ?? Infinity))
    .slice(0, rowCount);

  const highlightHash = transfers.find((t) => t.id === highlightId)?.txHash;

  return (
    <section className="ledger">
      <header className="ledger__head">
        <span className="ledger__title">
          <EconierMark size={16} />
          {title}
        </span>
        <span className="ledger__stats">
          <span className="live-dot" /> Block <b>#{current.toLocaleString("en-US")}</b>
          <span className="ledger__sep" />
          Finality ~3s
          <span className="ledger__sep" />
          Validators 21/21
        </span>
      </header>
      <table className="ledger__table">
        <thead>
          <tr>
            <th>Tx Hash</th>
            <th>Block</th>
            <th>From</th>
            <th>To</th>
            <th className="num">Amount (ECONIER)</th>
            <th>Status</th>
            <th className="num">Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.hash}
              className={[r.ours ? "is-ours" : "", r.hash === highlightHash ? "is-highlight" : ""].join(" ")}
            >
              <td className="mono">0x{shortHash(r.hash, 10, 6)}</td>
              <td className="mono">{r.block ? `#${r.block.toLocaleString("en-US")}` : "—"}</td>
              <td className="mono">{r.from}</td>
              <td className="mono">{r.to}</td>
              <td className="num mono">{money(r.amount)}</td>
              <td>
                {r.status === "pending" ? (
                  <span className="chip chip--pending">
                    <span className="spinner spinner--xs" /> Pending
                  </span>
                ) : (
                  <span className="chip chip--ok">✓ Finalized</span>
                )}
              </td>
              <td className="num muted">{age(now - r.time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function age(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/** 상태바의 자동 재생 스위치 — 이 창만 사람 손 없이 시나리오를 진행한다 */
export function AutoToggle({ screen }: { screen: Screen }) {
  const on = useAutoMode(screen);
  return (
    <button className={`auto-toggle ${on ? "is-on" : ""}`} onClick={() => setAutoMode(screen, !on)} title="Auto demo">
      <span className="auto-toggle__track">
        <span className="auto-toggle__thumb" />
      </span>
      AUTO
    </button>
  );
}
