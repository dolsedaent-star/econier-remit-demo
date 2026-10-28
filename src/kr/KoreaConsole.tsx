import { useEffect, useRef, useState } from "react";
import {
  isThaiOnline,
  RATES,
  resetDemo,
  shortHash,
  simulateIncoming,
  updateTransfer,
  useAutoMode,
  useTransfers,
  type Transfer,
} from "../shared/demo";
import { Field, Fieldset, Meta, SumRow, ToolBtn } from "../shared/form";
import { bizDate, clock, int, money, seconds, TZ_KR } from "../shared/format";
import { sleep, useLang, useNow } from "../shared/hooks";
import { KbankLogo } from "../shared/logos";
import { AutoToggle, EconierBadge, EconierMark, LedgerPanel, Modal, NODE_KR, NODE_TH, Steps, type StepState } from "../shared/ui";
import { KR_DICT, type KrDict, type KrLang } from "./i18n";

const DAY = 24 * 60 * 60 * 1000;

type SwiftRow = {
  ref: string;
  sender: string;
  bank: string;
  benef: string;
  amount: string;
  sentAgo: number;
  status: keyof KrDict["swiftStatus"];
  dplus: number;
};

const SWIFT_ROWS: SwiftRow[] = [
  {
    ref: "FX-IN-SW-0397",
    sender: "PRAPHAN SRISUK",
    bank: "RATTANA BANK (TH)",
    benef: "PARK JIHO",
    amount: "25,000.00 THB",
    sentAgo: 4 * DAY,
    status: "waiting",
    dplus: 4,
  },
  {
    ref: "FX-IN-SW-0402",
    sender: "NGUYEN VAN AN",
    bank: "SAIGON LOTUS BANK (VN)",
    benef: "CHOI YUNA",
    amount: "1,200.00 USD",
    sentAgo: 2 * DAY,
    status: "transit",
    dplus: 2,
  },
  {
    ref: "FX-IN-SW-0405",
    sender: "TANAKA HIROSHI",
    bank: "KANTO MIRAI BANK (JP)",
    benef: "JUNG HAEUN",
    amount: "150,000 JPY",
    sentAgo: 1 * DAY,
    status: "docs",
    dplus: 1,
  },
];

const DENOMS = [50000, 10000, 5000, 1000, 500, 100, 50, 10];

type Toast = { id: number; title: string; body: string };

type Modal_ =
  | { kind: "none" }
  | { kind: "credit"; step: number }
  | { kind: "payout"; paid: boolean };

export function KoreaConsole() {
  const [lang, setLang] = useLang<KrLang>("econier-demo-lang-kr-v2", "en");
  const t = KR_DICT[lang];
  const now = useNow(1000);
  const transfers = useTransfers();
  const autoMode = useAutoMode("kr");

  const visible = transfers.filter((x) => x.status !== "processing" && x.channel !== "swift");
  const swiftIncoming = transfers.filter((x) => x.channel === "swift" && x.status === "transit");
  const [selectedId, setSelectedId] = useState<string>();
  const selected = visible.find((x) => x.id === selectedId);

  const [kyc, setKyc] = useState(false);
  const [kycError, setKycError] = useState(false);
  const [modal, setModal] = useState<Modal_>({ kind: "none" });
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── 새 송금 감지 → 알림 + 자동 선택 ────────────────
  const detailRef = useRef<HTMLElement>(null);
  const [readyIds, setReadyIds] = useState<string[]>([]);
  const seen = useRef<Map<string, Transfer["status"]>>(new Map());
  const firstRun = useRef(true);
  useEffect(() => {
    for (const x of transfers) {
      const prev = seen.current.get(x.id);
      if (!firstRun.current && prev !== x.status) {
        if (x.status === "broadcast") {
          pushToast(t.toastNew, `${x.remitter.name} · RATTANA BANK (TH) · ${money(x.econier)} ECONIER`);
          setSelectedId(x.id);
          setKyc(false);
        } else if (x.status === "confirmed") {
          pushToast(t.toastConfirmed, `${x.ref} · Block #${x.block?.toLocaleString("en-US")}`);
          setSelectedId(x.id);
          // 장부 기록 2초 뒤 화면 맨 위에 "입금 확인 대기" 알림 줄을 띄운다
          setTimeout(() => setReadyIds((ids) => [...ids, x.id]), 2000);
        }
      }
      seen.current.set(x.id, x.status);
    }
    firstRun.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transfers]);

  function pushToast(title: string, body: string) {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, title, body }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 6000);
  }

  async function runCredit(id: string) {
    for (let s = 0; s < 4; s++) {
      setModal({ kind: "credit", step: s });
      await sleep(s === 0 ? 1200 : 900);
    }
    updateTransfer(id, { status: "credited", creditedAt: Date.now() });
    setModal({ kind: "credit", step: 4 });
  }

  function onPayout() {
    if (!kyc) {
      setKycError(true);
      return;
    }
    setKycError(false);
    setModal({ kind: "payout", paid: false });
  }

  function completePayout(id: string) {
    updateTransfer(id, { status: "paid", paidAt: Date.now() });
    setModal({ kind: "payout", paid: true });
  }

  // ── 자동 재생: 장부 확인되면 입금 확인 → 본인확인 → 현금 지급 ──
  // 태국 창이 없으면 한국 창이 직접 송금을 흘려보낸다 (한국 화면만 촬영할 때)
  useEffect(() => {
    if (!autoMode) return;
    const pending = transfers.some((x) => x.channel !== "swift" && x.status !== "paid");
    if (pending) return;
    const id = setTimeout(() => {
      if (!isThaiOnline()) simulateIncoming();
    }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode]);

  // F9: 태국 창 없이 한국 화면만 시연할 때 송금을 들여보낸다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F9") return;
      e.preventDefault();
      simulateIncoming();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const autoBusy = useRef(false);
  useEffect(() => {
    if (!autoMode || autoBusy.current) return;
    const target = transfers.find((x) => x.status === "confirmed" || x.status === "credited");
    if (!target) return;
    autoBusy.current = true;
    (async () => {
      setSelectedId(target.id);
      await sleep(target.status === "confirmed" ? 3200 : 1000);
      if (target.status === "confirmed") {
        await runCredit(target.id);
        await sleep(1200);
        setModal({ kind: "none" });
        await sleep(800);
      }
      setKyc(true);
      await sleep(1000);
      setModal({ kind: "payout", paid: false });
      await sleep(2500);
      completePayout(target.id);
      autoBusy.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, transfers]);

  const banner = transfers.find((x) => x.status === "confirmed" && readyIds.includes(x.id));

  const confirmedTimes = transfers.filter((x) => x.confirmedAt).map((x) => x.confirmedAt! - x.createdAt);
  const econierAvg = confirmedTimes.length
    ? `${seconds(confirmedTimes.reduce((a, b) => a + b, 0) / confirmedTimes.length)} ${t.sec}`
    : "—";
  const waiting = SWIFT_ROWS.length + swiftIncoming.length + visible.filter((x) => x.status !== "paid").length;

  return (
    <div className="console console--kr" lang={lang}>
      <header className="topbar">
        <div className="topbar__brand">
          <KbankLogo />
          <div>
            <div className="topbar__bank">{t.bankName}</div>
            <div className="topbar__app">{t.appName}</div>
          </div>
        </div>
        <div className="topbar__meta">
          <Meta label={t.branch} value={t.branchName} />
          <Meta label={t.user} value={t.userName} />
          <Meta label={t.bizDate} value={bizDate(now, TZ_KR)} />
          <Meta label="KST (UTC+9)" value={clock(now, TZ_KR)} mono />
          <div className="lang-toggle">
            <button className={lang === "ko" ? "is-on" : ""} onClick={() => setLang("ko")}>
              한국어
            </button>
            <button className={lang === "en" ? "is-on" : ""} onClick={() => setLang("en")}>
              EN
            </button>
          </div>
          <button className="topbar__out">{t.signOut}</button>
        </div>
      </header>

      <div className="fnbar">
        <label className="fnbar__id">
          {t.functionId}
          <input value="FXI2100" readOnly />
        </label>
        <span className="fnbar__title">{t.functionTitle}</span>
        <div className="fnbar__tools">
          <ToolBtn icon="🔍">{t.tbSearch}</ToolBtn>
          <ToolBtn icon="＋">{t.tbNew}</ToolBtn>
          <ToolBtn icon="💾">{t.tbSave}</ToolBtn>
          <ToolBtn icon="⎙">{t.tbPrint}</ToolBtn>
          <ToolBtn icon="⏻">{t.tbExit}</ToolBtn>
        </div>
      </div>

      <div className="workspace workspace--kr">
        <nav className="sidenav">
          {t.nav.map((g) => (
            <div key={g.group} className="sidenav__group">
              <div className="sidenav__head">▾ {g.group}</div>
              {g.items.map((it) => (
                <div key={it} className={`sidenav__item ${it === t.activeNav ? "is-active" : ""}`}>
                  {it}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <main className="main">
          {banner && (
            <div className="await-banner" key={banner.id}>
              <span className="await-banner__icon">
                <EconierMark size={26} />
              </span>
              <div className="await-banner__text">
                <span className="await-banner__title">{t.awaitTitle}</span>
                <span className="await-banner__body">
                  {banner.remitter.name} → {banner.beneficiary.name} ·{" "}
                  <b>{money(banner.econier)} ECONIER</b> ({int(banner.krw)} KRW) · {t.ledgerConfirmed} ✓
                </span>
              </div>
              <button
                className="btn btn--primary btn--econier is-ready await-banner__btn"
                onClick={() => {
                  setSelectedId(banner.id);
                  runCredit(banner.id);
                }}
              >
                {t.btnCredit}
              </button>
            </div>
          )}
          <div className="kpis">
            <Kpi label={t.kpiToday} value={String(visible.length + swiftIncoming.length)} />
            <Kpi label={t.kpiWaiting} value={String(waiting)} />
            <Kpi label={t.kpiSwiftAvg} value={`3.4 ${t.days}`} warn />
            <Kpi label={t.kpiEconierAvg} value={econierAvg} econier />
          </div>

          <section className="panel panel--flush">
            <div className="panel__bar">
              <h3 className="panel__title">{t.queueTitle}</h3>
              <div className="filters">
                <span className="filter is-on">{t.filterAll}</span>
                <span className="filter">SWIFT</span>
                <span className="filter">ECONIER</span>
              </div>
            </div>
            <table className="grid-table">
              <thead>
                <tr>
                  <th>{t.colRef}</th>
                  <th>{t.colChannel}</th>
                  <th>{t.colSender}</th>
                  <th>{t.colBenef}</th>
                  <th className="num">{t.colAmount}</th>
                  <th>{t.colSent}</th>
                  <th>{t.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((x) => (
                  <tr
                    key={x.id}
                    className={`is-clickable is-econier-row ${x.id === selectedId ? "is-selected" : ""}`}
                    onClick={() => {
                      setSelectedId(x.id);
                      setKyc(x.status === "paid");
                    }}
                  >
                    <td className="mono">{x.ref.replace("TH-ORM", "FX-IN-EC")}</td>
                    <td>
                      <EconierBadge />
                    </td>
                    <td>
                      {x.remitter.name}
                      <div className="muted small">{t.senderBankVal}</div>
                    </td>
                    <td>{x.beneficiary.name}</td>
                    <td className="num mono">
                      {money(x.econier)} ECONIER
                      <div className="muted small">≈ {int(x.krw)} KRW</div>
                    </td>
                    <td className="mono small">{clock(x.createdAt, TZ_KR)}</td>
                    <td>
                      <KrStatus status={x.status} label={t.status[x.status]} />
                    </td>
                  </tr>
                ))}
                {swiftIncoming.map((x) => (
                  <tr key={x.id} className="is-dim is-new-swift">
                    <td className="mono">{x.ref.replace("TH-ORM", "FX-IN-SW")}</td>
                    <td>
                      <span className="swift-badge">SWIFT</span>
                    </td>
                    <td>
                      {x.remitter.name}
                      <div className="muted small">{t.senderBankVal}</div>
                    </td>
                    <td>{x.beneficiary.name}</td>
                    <td className="num mono">{money(x.thb)} THB</td>
                    <td className="mono small">{clock(x.createdAt, TZ_KR)}</td>
                    <td>
                      <span className="chip chip--warn">
                        ⏳ {t.swiftStatus.transit} · D+0
                      </span>
                      {x.eta && (
                        <div className="muted small">
                          {t.eta} {bizDate(x.eta[0], TZ_KR)} ~ {bizDate(x.eta[1], TZ_KR)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {SWIFT_ROWS.map((r) => (
                  <tr key={r.ref} className="is-dim">
                    <td className="mono">{r.ref}</td>
                    <td>
                      <span className="swift-badge">SWIFT</span>
                    </td>
                    <td>
                      {r.sender}
                      <div className="muted small">{r.bank}</div>
                    </td>
                    <td>{r.benef}</td>
                    <td className="num mono">{r.amount}</td>
                    <td className="mono small">{bizDate(now - r.sentAgo, TZ_KR)}</td>
                    <td>
                      <span className="chip chip--warn">
                        ⏳ {t.swiftStatus[r.status]} · D+{r.dplus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel panel--detail" ref={detailRef}>
            <div className="panel__bar">
              <h3 className="panel__title">
                {t.detailTitle}
                {selected && <span className="mono muted small"> · {selected.ref.replace("TH-ORM", "FX-IN-EC")}</span>}
              </h3>
              {selected && (
                <div className="detail-actions">
                  <button
                    className={`btn btn--primary btn--econier ${selected.status === "confirmed" ? "is-ready" : ""}`}
                    disabled={selected.status !== "confirmed"}
                    onClick={() => runCredit(selected.id)}
                  >
                    {t.btnCredit}
                  </button>
                  <button
                    className={`btn btn--primary ${selected.status === "credited" ? "is-ready" : ""}`}
                    disabled={selected.status !== "credited"}
                    onClick={onPayout}
                  >
                    ₩ {t.btnPayout}
                  </button>
                </div>
              )}
            </div>
            {!selected ? (
              <p className="empty">{t.detailEmpty}</p>
            ) : (
              <Detail
                t={t}
                x={selected}
                kyc={kyc}
                kycError={kycError}
                onKyc={(v) => {
                  setKyc(v);
                  setKycError(false);
                }}
              />
            )}
          </section>

          <LedgerPanel transfers={transfers} highlightId={selectedId} rows={5} />
        </main>
      </div>

      <footer className="statusbar">
        <span>{t.footer}</span>
        <span className="statusbar__right">
          <span className="live-dot" /> {NODE_KR} · ECONIER Network connected
          <AutoToggle screen="kr" />
          <button className="link" onClick={resetDemo}>
            {t.reset}
          </button>
        </span>
      </footer>

      <div className="toasts">
        {toasts.map((x) => (
          <div key={x.id} className="toast">
            <EconierMark size={22} />
            <div>
              <div className="toast__title">{x.title}</div>
              <div className="toast__body">{x.body}</div>
            </div>
          </div>
        ))}
      </div>

      {modal.kind === "credit" && selected && (
        <CreditModal t={t} step={modal.step} x={selected} onClose={() => setModal({ kind: "none" })} />
      )}
      {modal.kind === "payout" && selected && (
        <PayoutModal
          t={t}
          lang={lang}
          x={selected}
          paid={modal.paid}
          onCancel={() => setModal({ kind: "none" })}
          onComplete={() => completePayout(selected.id)}
        />
      )}
    </div>
  );
}

function Detail({
  t,
  x,
  kyc,
  kycError,
  onKyc,
}: {
  t: KrDict;
  x: Transfer;
  kyc: boolean;
  kycError: boolean;
  onKyc: (v: boolean) => void;
}) {
  // 단계별 완료 수: 수신 중이면 1단계 진행, 장부 확인되면 2단계까지 완료
  const doneCount = { processing: 0, broadcast: 0, confirmed: 2, credited: 3, paid: 4, transit: 0 }[x.status];
  const confirmed = doneCount >= 2;
  return (
    <>
      <ol className="flow">
        {t.flow.map((label, i) => (
          <li key={label} className={`flow__step ${i < doneCount ? "is-done" : i === doneCount ? "is-active" : ""}`}>
            <span className="flow__dot">{i < doneCount ? "✓" : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <div className="detail">
        <div className="detail__col">
          <Fieldset title={t.secSender}>
            <div className="grid grid--2">
              <Field label={t.sender} value={x.remitter.name} />
              <Field label={t.senderBank} value={t.senderBankVal} />
              <Field label={t.senderNode} value={NODE_TH} mono econier />
              <Field label={t.purpose} value={t.purposeVal} />
            </div>
          </Fieldset>
          <Fieldset title={t.secBenef}>
            <div className="grid grid--2">
              <Field label={t.benef} value={x.beneficiary.name} />
              <Field label={t.benefAccount} value={x.beneficiary.account} mono />
              <Field label={t.phone} value="010-****-5821" mono />
              <Field label={t.payMethod} value={t.payMethodVal} />
            </div>
          </Fieldset>
        </div>

        <div className="detail__col">
          <Fieldset title={t.secAmount}>
            <div className="calc">
              <div className="calc__row">
                <span className="calc__label">{t.sentAmount}</span>
                <span className="calc__value">{money(x.thb)} THB</span>
              </div>
              <div className="calc__row">
                <span className="calc__label">{t.received}</span>
                <span className="calc__value is-strong is-econier">{money(x.econier)} ECONIER</span>
              </div>
              <div className="calc__row">
                <span className="calc__label">{t.rate}</span>
                <span className="calc__value">1 ECONIER = 1.00 USD = {money(RATES.usdKrw)} KRW</span>
              </div>
              <div className="calc__row">
                <span className="calc__label">{t.benefFee}</span>
                <span className="calc__value">{t.benefFeeVal}</span>
              </div>
              <div className="calc__row calc__row--total">
                <span className="calc__label">{t.krwAmount}</span>
                <span className="calc__value is-strong">{int(x.krw)} KRW</span>
              </div>
            </div>
          </Fieldset>
        </div>

        <div className="detail__col">
          <div className={`ledger-card ${confirmed ? "is-ok" : ""}`}>
            <div className="ledger-card__head">
              <EconierMark size={18} /> {t.secLedger}
            </div>
            {!confirmed ? (
              <div className="ledger-card__wait">
                <span className="spinner" /> {t.ledgerWaiting}
                {x.confirmations ? <span className="mono small"> {x.confirmations}/3</span> : null}
              </div>
            ) : (
              <>
                <div className="ledger-card__ok">✓ {t.ledgerConfirmed}</div>
                <dl className="summary summary--tight">
                  <SumRow k={t.txHash} v={`0x${shortHash(x.txHash ?? "", 10, 8)}`} mono />
                  <SumRow k={t.block} v={`#${x.block?.toLocaleString("en-US")}`} mono />
                  <SumRow k={t.confirmations} v="3 / 3" mono />
                  <SumRow k={t.ledgerTime} v={`${clock(x.confirmedAt ?? 0, TZ_KR)} KST`} mono />
                  <SumRow k={t.elapsed} v={`${seconds((x.confirmedAt ?? 0) - x.createdAt)} ${t.sec}`} strong econier />
                </dl>
              </>
            )}
          </div>
        </div>
      </div>

      {(x.status === "credited" || x.status === "paid") && (
        <Fieldset title={t.secKyc}>
          <div className="kyc">
            <Field label={t.idType} value={t.idTypeVal} select />
            <Field label={t.idNo} value="950314-1••••••" mono />
            <label className={`check ${kycError ? "is-error" : ""}`}>
              <input type="checkbox" checked={kyc} disabled={x.status === "paid"} onChange={(e) => onKyc(e.target.checked)} />
              {t.idCheck}
            </label>
          </div>
          {kycError && <div className="notice notice--error">{t.errKyc}</div>}
        </Fieldset>
      )}

    </>
  );
}

function CreditModal({ t, step, x, onClose }: { t: KrDict; step: number; x: Transfer; onClose: () => void }) {
  const st = (i: number): StepState => (step > i ? "done" : step === i ? "active" : "wait");
  const done = step >= 4;
  return (
    <Modal
      title={done ? t.crDoneTitle : t.creditTitle}
      tone="econier"
      onClose={done ? onClose : undefined}
      footer={
        done ? (
          <button className="btn btn--primary" onClick={onClose}>
            {t.btnClose}
          </button>
        ) : undefined
      }
    >
      <Steps
        items={[
          { label: t.crLedger, detail: step > 0 ? `${t.crLedgerDone} · Block #${x.block?.toLocaleString("en-US")}` : undefined, state: st(0) },
          { label: t.crMatch, detail: step > 1 ? `${money(x.econier)} ECONIER · ${x.beneficiary.name}` : undefined, state: st(1) },
          { label: t.crConvert, detail: step > 2 ? `${money(x.econier)} ECONIER → ${int(x.krw)} KRW` : undefined, state: st(2) },
          { label: t.crBook, detail: step > 3 ? `${int(x.krw)} KRW` : undefined, state: st(3) },
        ]}
      />
      {done && (
        <div className="credit-done">
          <span className="done__check done__check--sm">✓</span>
          <span className="credit-done__amt">{int(x.krw)} KRW</span>
        </div>
      )}
    </Modal>
  );
}

function PayoutModal({
  t,
  lang,
  x,
  paid,
  onCancel,
  onComplete,
}: {
  t: KrDict;
  lang: KrLang;
  x: Transfer;
  paid: boolean;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const payout = Math.floor(x.krw / 10) * 10;
  let rest = payout;
  const rows = DENOMS.map((d) => {
    const q = Math.floor(rest / d);
    rest -= q * d;
    return { d, q };
  }).filter((r) => r.q > 0);

  return (
    <Modal
      title={t.payoutTitle}
      width={520}
      onClose={onCancel}
      footer={
        paid ? (
          <>
            <button className="btn">{t.btnPrintSlip}</button>
            <button className="btn btn--primary" onClick={onCancel}>
              {t.btnClose}
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={onCancel}>
              {t.cancel}
            </button>
            <button className="btn btn--primary" onClick={onComplete}>
              ₩ {t.confirmPayout}
            </button>
          </>
        )
      }
    >
      <div className="payout">
        {paid && <div className="stamp">{t.paidStamp}</div>}
        <p className="muted">{paid ? t.paidLead : t.payoutLead}</p>
        <dl className="summary summary--tight">
          <SumRow k={t.benef} v={x.beneficiary.name} />
          <SumRow k={t.received} v={`${money(x.econier)} ECONIER`} econier />
        </dl>
        <table className="denoms">
          <thead>
            <tr>
              <th>{t.denom}</th>
              <th className="num">{t.qty}</th>
              <th className="num">{t.subtotal}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.d}>
                <td>
                  <span className={`bill ${r.d >= 1000 ? "bill--note" : "bill--coin"}`}>
                    {lang === "ko" ? `${int(r.d)}원` : `₩${int(r.d)}`}
                  </span>
                </td>
                <td className="num mono">{r.q}</td>
                <td className="num mono">{int(r.d * r.q)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>{t.total}</td>
              <td className="num">{lang === "ko" ? `${int(payout)}원` : `KRW ${int(payout)}`}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Modal>
  );
}

function Kpi({ label, value, warn, econier }: { label: string; value: string; warn?: boolean; econier?: boolean }) {
  return (
    <div className={`kpi ${warn ? "kpi--warn" : ""} ${econier ? "kpi--econier" : ""}`}>
      <span className="kpi__label">
        {econier && <EconierMark size={14} />} {label}
      </span>
      <span className="kpi__value">{value}</span>
    </div>
  );
}

function KrStatus({ status, label }: { status: Transfer["status"]; label: string }) {
  const tone = status === "broadcast" ? "pending" : status === "paid" ? "paid" : status === "confirmed" ? "ok" : "info";
  return (
    <span className={`chip chip--${tone}`}>
      {tone === "pending" && <span className="spinner spinner--xs" />} {label}
    </span>
  );
}
