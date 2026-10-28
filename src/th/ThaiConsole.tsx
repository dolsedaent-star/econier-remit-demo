import { useCallback, useEffect, useRef, useState } from "react";
import {
  addBusinessDays,
  addTransfer,
  beatThai,
  BENEFICIARY,
  REMITTER,
  blockAt,
  econierToKrw,
  NETWORK_FEE_USD,
  randomHex,
  RATES,
  resetDemo,
  setAutoMode,
  shortHash,
  thbToEconier,
  updateTransfer,
  useAutoMode,
  useTransfers,
  type Transfer,
} from "../shared/demo";
import { bizDate, clock, int, money, seconds, TZ_TH, ymd } from "../shared/format";
import { sleep, useLang, useNow } from "../shared/hooks";
import { RattanaLogo } from "../shared/logos";
import { AutoToggle, EconierBadge, EconierMark, LedgerPanel, Modal, NODE_KR, NODE_TH, Steps, type StepState } from "../shared/ui";
import { Field, Fieldset, Meta, SumRow, ToolBtn } from "../shared/form";
import { TH_DICT, type ThLang } from "./i18n";

type Network = "swift" | "econier";

const BALANCE = 248_350;
const BANK_FEE = 100;
const SWIFT_FEES = { wire: 400, corrUsd: 25, cable: 200 };


type Phase =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "progress"; step: number; startedAt: number; id: string }
  | { kind: "done"; id: string }
  | { kind: "swiftProgress"; step: number; id: string }
  | { kind: "swiftDone"; id: string };

export function ThaiConsole() {
  const [lang, setLang] = useLang<ThLang>("econier-demo-lang-th-v2", "en");
  const t = TH_DICT[lang];
  const now = useNow(1000);
  const transfers = useTransfers();

  const [network, setNetwork] = useState<Network>("econier");
  const [amountText, setAmountText] = useState("");
  const [idVerified, setIdVerified] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "ok" | "info"; text: string } | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [highlightId, setHighlightId] = useState<string>();
  const ledgerRef = useRef<HTMLDivElement>(null);

  const amount = Number(amountText.replace(/,/g, "")) || 0;
  const econier = thbToEconier(amount);
  const krw = econierToKrw(econier);
  const networkFeeThb = Math.round(NETWORK_FEE_USD * RATES.usdThb * 100) / 100;
  const swiftFeeThb = SWIFT_FEES.wire + SWIFT_FEES.corrUsd * RATES.usdThb + SWIFT_FEES.cable;
  const econierFeeThb = BANK_FEE + networkFeeThb;
  const totalDebit = amount + (network === "econier" ? econierFeeThb : swiftFeeThb);

  const seq = transfers.length + 184;
  const reference = `TH-ORM-${ymd(now, TZ_TH)}-${String(seq).padStart(6, "0")}`;

  function onAmountChange(raw: string) {
    const digits = raw.replace(/[^\d]/g, "").slice(0, 9);
    setAmountText(digits ? Number(digits).toLocaleString("en-US") : "");
    setNotice(null);
  }

  function validate(): boolean {
    if (!amount) return fail(t.errAmount);
    if (totalDebit > BALANCE) return fail(t.errBalance);
    if (!idVerified) return fail(t.errId);
    return true;
  }

  function fail(text: string) {
    setNotice({ tone: "error", text });
    return false;
  }

  function onSubmit() {
    if (!validate()) return;
    setNotice(null);
    setPhase({ kind: "confirm" });
  }

  const send = useCallback(async () => {
    const id = randomHex(12);
    const startedAt = Date.now();
    const transfer: Transfer = {
      id,
      ref: reference,
      createdAt: startedAt,
      thb: amount,
      econier,
      krw,
      remitter: REMITTER,
      beneficiary: BENEFICIARY,
      purpose: "Family Support",
      status: "processing",
    };
    addTransfer(transfer);
    const go = (step: number) => setPhase({ kind: "progress", step, startedAt, id });

    go(0);
    await sleep(1100);
    go(1);
    await sleep(1100);
    go(2);
    await sleep(900);
    go(3);
    await sleep(1000);
    updateTransfer(id, { status: "broadcast", txHash: randomHex(64) });
    await sleep(400);
    go(4);
    const block = blockAt();
    for (let c = 1; c <= 3; c++) {
      await sleep(1000);
      updateTransfer(id, { block, confirmations: c });
    }
    go(5);
    await sleep(700);
    updateTransfer(id, { status: "confirmed", confirmedAt: Date.now() });
    go(6);
    await sleep(500);
    setHighlightId(id);
    setPhase({ kind: "done", id });
  }, [reference, amount, econier, krw]);

  async function sendSwift() {
    const id = randomHex(12);
    const createdAt = Date.now();
    addTransfer({
      id,
      ref: reference,
      createdAt,
      thb: amount,
      econier,
      krw,
      remitter: REMITTER,
      beneficiary: BENEFICIARY,
      purpose: "Family Support",
      status: "processing",
      channel: "swift",
    });
    for (let s = 0; s < 4; s++) {
      setPhase({ kind: "swiftProgress", step: s, id });
      await sleep(900);
    }
    updateTransfer(id, {
      status: "transit",
      eta: [addBusinessDays(createdAt, 2), addBusinessDays(createdAt, 5)],
    });
    setPhase({ kind: "swiftProgress", step: 4, id });
    await sleep(400);
    setPhase({ kind: "swiftDone", id });
  }

  function newTransaction() {
    setPhase({ kind: "idle" });
    setAmountText("");
    setIdVerified(false);
    setNotice(null);
  }

  function viewLedger() {
    setPhase({ kind: "idle" });
    ledgerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // 한국 창이 태국 창 접속 여부를 알 수 있게 신호를 남긴다
  useEffect(() => {
    beatThai();
    const id = setInterval(beatThai, 1500);
    return () => clearInterval(id);
  }, []);

  // ── 자동 재생: 상태바 토글 · ?auto · F9 ───────────
  const autoMode = useAutoMode("th");
  const [autoTick, setAutoTick] = useState(0);
  const autoFlow = useRef(false);
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (autoMode) setAutoTick((n) => n + 1);
  }, [autoMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F9") return;
      e.preventDefault();
      setAutoMode("th", true);
      setAutoTick((n) => n + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!autoMode || autoTick === 0) return;
    let cancelled = false;
    (async () => {
      setPhase({ kind: "idle" });
      setAmountText("");
      setIdVerified(false);
      setNotice(null);
      await sleep(600);
      if (cancelled) return;
      setNetwork("swift");
      await sleep(900);
      if (cancelled) return;
      setNetwork("econier");
      await sleep(700);
      for (const ch of "10000") {
        if (cancelled) return;
        setAmountText((prev) => Number(prev.replace(/,/g, "") + ch).toLocaleString("en-US"));
        await sleep(180);
      }
      await sleep(700);
      if (cancelled) return;
      setIdVerified(true);
      await sleep(600);
      if (cancelled) return;
      autoFlow.current = true;
      setPhase({ kind: "confirm" });
    })();
    return () => {
      cancelled = true;
    };
  }, [autoTick, autoMode]);

  // 자동 재생 중 확인 모달이 열리면 잠시 보여 준 뒤 승인
  useEffect(() => {
    if (phase.kind !== "confirm" || !autoFlow.current) return;
    const id = setTimeout(() => {
      autoFlow.current = false;
      sendRef.current();
    }, 1500);
    return () => clearTimeout(id);
  }, [phase.kind]);

  const current = "id" in phase ? transfers.find((x) => x.id === phase.id) : undefined;

  return (
    <div className="console console--th" lang={lang === "th" ? "th" : "en"}>
      <header className="topbar">
        <div className="topbar__brand">
          <RattanaLogo />
          <div>
            <div className="topbar__bank">{t.bankName}</div>
            <div className="topbar__app">{t.appName}</div>
          </div>
        </div>
        <div className="topbar__meta">
          <Meta label={t.branch} value={t.branchName} />
          <Meta label={t.user} value={t.userName} />
          <Meta label={t.bizDate} value={bizDate(now, TZ_TH)} />
          <Meta label="ICT (UTC+7)" value={clock(now, TZ_TH)} mono />
          <div className="lang-toggle">
            <button className={lang === "en" ? "is-on" : ""} onClick={() => setLang("en")}>
              EN
            </button>
            <button className={lang === "th" ? "is-on" : ""} onClick={() => setLang("th")}>
              ไทย
            </button>
          </div>
          <button className="topbar__out">{t.signOut}</button>
        </div>
      </header>

      <div className="fnbar">
        <label className="fnbar__id">
          {t.functionId}
          <input value="PXOUTRMT" readOnly />
        </label>
        <span className="fnbar__title">{t.functionTitle}</span>
        <div className="fnbar__tools">
          <ToolBtn icon="＋">{t.tbNew}</ToolBtn>
          <ToolBtn icon="💾">{t.tbSave}</ToolBtn>
          <ToolBtn icon="✔">{t.tbAuth}</ToolBtn>
          <ToolBtn icon="⎙">{t.tbPrint}</ToolBtn>
          <ToolBtn icon="⏻">{t.tbExit}</ToolBtn>
        </div>
      </div>

      <div className="workspace">
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
          <Fieldset title={t.secTxn}>
            <div className="grid grid--4">
              <Field label={t.reference} value={reference} mono />
              <Field label={t.product} value={t.productVal} />
              <Field label={t.valueDate} value={bizDate(now, TZ_TH)} mono />
              <Field label={t.channel} value={t.channelVal} />
            </div>
          </Fieldset>

          <Fieldset title={t.secNetwork}>
            <div className="netpick">
              <NetCard
                selected={network === "swift"}
                onClick={() => setNetwork("swift")}
                title={t.swiftName}
                desc={t.swiftDesc}
                icon={<span className="netcard__swift">SWIFT</span>}
              />
              <NetCard
                selected={network === "econier"}
                onClick={() => setNetwork("econier")}
                title={t.econierName}
                desc={t.econierDesc}
                icon={<EconierMark size={30} />}
                badge={t.recommended}
                econier
              />
            </div>
          </Fieldset>

          <div className="grid grid--2 gap">
            <Fieldset title={t.secRemitter}>
              <div className="grid grid--2">
                <Field label={t.cif} value="00481275" mono />
                <Field label={t.debitAccount} value={`${REMITTER.account} · ${t.accountType}`} mono />
                <Field label={t.remitterName} value={lang === "th" ? REMITTER.nameTh : REMITTER.name} />
                <Field label={t.idCard} value="1-1037-•••••-••-1" mono />
                <Field label={t.available} value={`${money(BALANCE)} THB`} mono strong />
              </div>
            </Fieldset>

            <Fieldset title={t.secBenef}>
              <div className="grid grid--2">
                <Field label={t.country} value={t.countryVal} />
                <Field label={t.benefBank} value={t.benefBankVal} />
                {network === "swift" ? (
                  <Field label={t.swiftBic} value="KBNKKRSEXXX" mono />
                ) : (
                  <Field label={t.networkNode} value={`${NODE_KR} · K bank`} mono econier />
                )}
                <Field label={t.benefAccount} value={BENEFICIARY.account} mono />
                <Field label={t.benefName} value={BENEFICIARY.name} />
                <Field label={t.mobile} value={BENEFICIARY.phone} mono />
              </div>
            </Fieldset>
          </div>

          <Fieldset title={t.secAmount}>
            <div className="amount-row">
              <label className="amount-input">
                <span className="field__label">
                  {t.remitAmount} <span className="req">*</span>
                </span>
                <span className="amount-input__box">
                  <input
                    inputMode="numeric"
                    placeholder={t.amountPh}
                    value={amountText}
                    onChange={(e) => onAmountChange(e.target.value)}
                    autoFocus
                  />
                  <span className="amount-input__ccy">THB</span>
                </span>
              </label>

              {network === "econier" ? (
                <div className="calc">
                  <Calc label={t.settleAsset} value={<EconierBadge />} />
                  <Calc label={t.rate} value={`1 ECONIER = 1.00 USD = ${money(RATES.usdThb)} THB`} />
                  <Calc label={t.econierAmount} value={`${money(econier)} ECONIER`} strong econier />
                  <Calc label={t.benefReceives} value={`${int(krw)} KRW`} strong />
                  <Calc label={t.bankFee} value={`${money(BANK_FEE)} THB`} />
                  <Calc label={t.networkFee} value={`${NETWORK_FEE_USD} USD (≈ ${money(networkFeeThb)} THB)`} />
                  <Calc label={t.estArrival} value={t.econierTime} econier strong />
                  <Calc label={t.totalDebit} value={`${money(amount ? totalDebit : 0)} THB`} strong />
                </div>
              ) : (
                <div className="calc">
                  <Calc label={t.charges} value={t.chargesVal} />
                  <Calc label={t.correspondent} value={t.correspondentVal} />
                  <Calc label={t.rate} value={`1 USD = ${money(RATES.usdThb)} THB`} />
                  <Calc label={t.benefReceives} value={`${int(krw)} KRW`} strong />
                  <Calc label={t.wireFee} value={`${money(SWIFT_FEES.wire)} THB`} />
                  <Calc
                    label={t.corrFee}
                    value={`${SWIFT_FEES.corrUsd} USD (≈ ${money(SWIFT_FEES.corrUsd * RATES.usdThb)} THB)`}
                  />
                  <Calc label={t.cableFee} value={`${money(SWIFT_FEES.cable)} THB`} />
                  <Calc label={t.estArrival} value={t.businessDays} warn strong />
                  <Calc label={t.totalDebit} value={`${money(amount ? totalDebit : 0)} THB`} strong />
                </div>
              )}
            </div>
            <div className="grid grid--3 mt">
              <Field label={t.purpose} value={t.purposeVal} select />
            </div>
          </Fieldset>

          <div className="actionbar">
            <div className="actionbar__checks">
              <label className="check">
                <input type="checkbox" checked={idVerified} onChange={(e) => setIdVerified(e.target.checked)} />
                {t.idVerified}
              </label>
              <span className="muted small">ⓘ {t.amlNote}</span>
            </div>
            {notice && <div className={`notice notice--${notice.tone}`}>{notice.text}</div>}
            <div className="actionbar__btns">
              <button className="btn" onClick={newTransaction}>
                {t.btnClear}
              </button>
              <button className="btn" onClick={() => validate() && setNotice({ tone: "ok", text: t.validated })}>
                {t.btnValidate}
              </button>
              <button className={`btn btn--primary ${network === "econier" ? "btn--econier" : ""}`} onClick={onSubmit}>
                {network === "econier" ? t.btnSubmit : t.btnSubmitSwift}
              </button>
            </div>
          </div>

          <div ref={ledgerRef}>
            <LedgerPanel transfers={transfers} highlightId={highlightId} rows={5} />
          </div>
        </main>

        <aside className="aside">
          <section className="panel">
            <h3 className="panel__title">{t.cmpTitle}</h3>
            <table className="cmp">
              <thead>
                <tr>
                  <th />
                  <th className={network === "swift" ? "is-sel" : ""}>SWIFT</th>
                  <th className={`cmp__econier ${network === "econier" ? "is-sel" : ""}`}>ECONIER</th>
                </tr>
              </thead>
              <tbody>
                <CmpRow label={t.cmpTime} a={t.swiftTime} b={t.econierTime} />
                <CmpRow
                  label={t.cmpFees}
                  a={`≈ ${int(swiftFeeThb)} THB`}
                  b={`≈ ${int(econierFeeThb)} THB`}
                />
                <CmpRow label={t.cmpHops} a={t.swiftHops} b={t.econierHops} />
                <CmpRow label={t.cmpTrack} a={t.swiftTrack} b={t.econierTrack} />
                <CmpRow label={t.cmpHours} a={t.swiftHours} b={t.econierHours} />
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h3 className="panel__title">{t.todayTitle}</h3>
            {transfers.length === 0 ? (
              <p className="muted small">{t.todayEmpty}</p>
            ) : (
              <ul className="today">
                {transfers.map((x) => (
                  <li key={x.id} className="today__item">
                    <div className="today__row">
                      <span className="mono small">{x.ref}</span>
                      <StatusChip status={x.status} label={t.status[x.status]} />
                    </div>
                    <div className="today__row">
                      <span>
                        {x.beneficiary.name} · <b>{money(x.thb)} THB</b>
                      </span>
                      <span className="muted small mono">{clock(x.createdAt, TZ_TH)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <footer className="statusbar">
        <span>{t.footer}</span>
        <span className="statusbar__right">
          <span className="live-dot" /> {NODE_TH} · ECONIER Network connected
          <AutoToggle screen="th" />
          <button className="link" onClick={resetDemo}>
            {t.reset}
          </button>
        </span>
      </footer>

      {phase.kind === "confirm" && network === "swift" && (
        <Modal
          title={t.swConfirmTitle}
          onClose={() => setPhase({ kind: "idle" })}
          footer={
            <>
              <button className="btn" onClick={() => setPhase({ kind: "idle" })}>
                {t.cancel}
              </button>
              <button className="btn btn--primary" onClick={sendSwift}>
                {t.swConfirmBtn}
              </button>
            </>
          }
        >
          <p className="muted">{t.confirmLead}</p>
          <dl className="summary">
            <SumRow k={t.reference} v={reference} mono />
            <SumRow k={t.secNetwork} v={<span className="swift-badge">SWIFT MT103</span>} />
            <SumRow k={t.secRemitter} v={`${REMITTER.name} · ${REMITTER.account}`} />
            <SumRow k={t.secBenef} v={`${BENEFICIARY.name} · ${t.benefBankVal}`} />
            <SumRow k={t.swiftBic} v="KBNKKRSEXXX" mono />
            <SumRow k={t.correspondent} v={t.correspondentVal} />
            <SumRow k={t.remitAmount} v={`${money(amount)} THB`} strong />
            <SumRow k={t.swCharges} v={`${money(swiftFeeThb)} THB`} />
            <SumRow k={t.totalDebit} v={`${money(totalDebit)} THB`} />
            <SumRow k={t.estArrival} v={t.businessDays} />
          </dl>
        </Modal>
      )}

      {phase.kind === "swiftProgress" && (
        <Modal title={t.swProgressTitle} width={520}>
          <Steps
            items={[
              { label: t.stAml, detail: phase.step > 0 ? t.stAmlDone : undefined, state: swSt(phase.step, 0) },
              {
                label: t.swStDebit,
                detail: phase.step > 1 ? `${money(amount)} THB → ${money(econier)} USD` : undefined,
                state: swSt(phase.step, 1),
              },
              { label: t.swStMt103, detail: phase.step > 2 ? `:20: ${reference}` : undefined, state: swSt(phase.step, 2) },
              { label: t.swStSend, detail: phase.step > 3 ? t.swStSendDone : undefined, state: swSt(phase.step, 3) },
            ]}
          />
        </Modal>
      )}

      {phase.kind === "swiftDone" && current && (
        <SwiftDoneModal
          t={t}
          x={current}
          fee={swiftFeeThb}
          onClose={() => setPhase({ kind: "idle" })}
          onNew={newTransaction}
        />
      )}

      {phase.kind === "confirm" && network === "econier" && (
        <Modal
          title={t.confirmTitle}
          onClose={() => setPhase({ kind: "idle" })}
          footer={
            <>
              <button className="btn" onClick={() => setPhase({ kind: "idle" })}>
                {t.cancel}
              </button>
              <button className="btn btn--primary btn--econier" onClick={send}>
                {t.confirmBtn}
              </button>
            </>
          }
        >
          <p className="muted">{t.confirmLead}</p>
          <dl className="summary">
            <SumRow k={t.reference} v={reference} mono />
            <SumRow k={t.secNetwork} v={<EconierBadge />} />
            <SumRow k={t.secRemitter} v={`${REMITTER.name} · ${REMITTER.account}`} />
            <SumRow k={t.secBenef} v={`${BENEFICIARY.name} · ${t.benefBankVal}`} />
            <SumRow k={t.remitAmount} v={`${money(amount)} THB`} strong />
            <SumRow k={t.econierAmount} v={`${money(econier)} ECONIER`} strong econier />
            <SumRow k={t.benefReceives} v={`${int(krw)} KRW`} />
            <SumRow k={t.totalDebit} v={`${money(totalDebit)} THB`} />
          </dl>
        </Modal>
      )}

      {phase.kind === "progress" && (
        <ProgressModal t={t} step={phase.step} startedAt={phase.startedAt} transfer={current} />
      )}

      {phase.kind === "done" && current && (
        <Modal
          title={t.doneTitle}
          tone="econier"
          width={600}
          onClose={() => setPhase({ kind: "idle" })}
          footer={
            <>
              <button className="btn">{t.btnPrint}</button>
              <button className="btn" onClick={viewLedger}>
                Ledger ↓
              </button>
              <button className="btn btn--primary btn--econier" onClick={newTransaction}>
                {t.btnNew}
              </button>
            </>
          }
        >
          <div className="done">
            <div className="done__check">✓</div>
            <div className="done__amount">
              {money(current.thb)} THB <span className="done__arrow">→</span> {money(current.econier)} ECONIER
            </div>
            <p className="muted">{t.doneLead}</p>
            <div className="done__time">
              <div>
                <span className="done__label">{t.doneIn}</span>
                <span className="done__big">
                  {seconds((current.confirmedAt ?? now) - current.createdAt)} <small>{t.sec}</small>
                </span>
              </div>
              <div className="done__vs">
                <span className="done__label">{t.swiftWould}</span>
                <span className="done__strike">{t.businessDays}</span>
              </div>
            </div>
            <dl className="summary">
              <SumRow k={t.txHash} v={`0x${shortHash(current.txHash ?? "", 14, 10)}`} mono />
              <SumRow k={t.block} v={`#${current.block?.toLocaleString("en-US")} · 3/3`} mono />
              <SumRow k={t.ledgerTime} v={`${clock(current.confirmedAt ?? now, TZ_TH)} ICT`} mono />
              <SumRow k={t.secBenef} v={`${current.beneficiary.name} · ${int(current.krw)} KRW`} />
            </dl>
          </div>
        </Modal>
      )}
    </div>
  );
}

const swSt = (step: number, i: number): StepState => (step > i ? "done" : step === i ? "active" : "wait");

function SwiftDoneModal({
  t,
  x,
  fee,
  onClose,
  onNew,
}: {
  t: (typeof TH_DICT)["en"];
  x: Transfer;
  fee: number;
  onClose: () => void;
  onNew: () => void;
}) {
  const now = useNow(100);
  return (
    <Modal
      title={t.swDoneTitle}
      width={640}
      onClose={onClose}
      footer={
        <>
          <button className="btn">{t.btnPrint}</button>
          <button className="btn btn--primary" onClick={onNew}>
            {t.btnNew}
          </button>
        </>
      }
    >
      <p className="muted">{t.swDoneLead}</p>
      <ol className="hops">
        {t.swHops.map((h, i) => {
          const state = i === 0 ? "sent" : i === 1 ? "queued" : "pending";
          return (
            <li key={h} className={`hop hop--${state}`}>
              <span className="hop__dot">{state === "sent" ? "✓" : state === "queued" ? "⏳" : ""}</span>
              <span className="hop__name">{h}</span>
              <span className="hop__status">
                {state === "sent" ? t.swHopSent : state === "queued" ? t.swHopQueued : t.swHopPending}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="done__time">
        <div className="swift-eta">
          <span className="done__label">{t.swEta}</span>
          <span className="swift-eta__val">
            {x.eta ? `${bizDate(x.eta[0], TZ_TH)} ~ ${bizDate(x.eta[1], TZ_TH)}` : t.businessDays}
          </span>
          <span className="muted small">
            {t.swElapsed}: {seconds(now - x.createdAt)}s
          </span>
        </div>
        <div className="swift-vs">
          <span className="done__label">{t.swEconierWould}</span>
          <span className="swift-vs__val">
            <EconierMark size={18} /> {t.swEconierTime}
          </span>
        </div>
      </div>
      <dl className="summary">
        <SumRow k={t.remitAmount} v={`${money(x.thb)} THB`} strong />
        <SumRow k={t.swCharges} v={`${money(fee)} THB`} />
        <SumRow k={t.swTracking} v={t.swTrackingVal} />
      </dl>
      <div className="notice notice--info mt">⚠ {t.swDeduct}</div>
    </Modal>
  );
}

function ProgressModal({
  t,
  step,
  startedAt,
  transfer,
}: {
  t: (typeof TH_DICT)["en"];
  step: number;
  startedAt: number;
  transfer?: Transfer;
}) {
  const now = useNow(100);
  const st = (i: number): StepState => (step > i ? "done" : step === i ? "active" : "wait");
  const conf = transfer?.confirmations ?? 0;
  return (
    <Modal title={t.progressTitle} tone="econier" width={560}>
      <div className="progress-head">
        <div className="route">
          <span className="route__node">🇹🇭 {NODE_TH}</span>
          <span className="route__line">
            <span className="route__dot" />
          </span>
          <span className="route__node">🇰🇷 {NODE_KR}</span>
        </div>
        <div className="timer">
          <span className="muted small">{t.elapsed}</span>
          <span className="timer__val mono">{seconds(now - startedAt)}s</span>
        </div>
      </div>
      <Steps
        items={[
          { label: t.stAml, detail: step > 0 ? t.stAmlDone : undefined, state: st(0) },
          {
            label: t.stConvert,
            detail: transfer ? `${money(transfer.thb)} THB → ${money(transfer.econier)} ECONIER` : undefined,
            state: st(1),
          },
          { label: t.stSign, detail: step > 2 ? `${t.stSignDone} ${NODE_TH}` : undefined, state: st(2) },
          {
            label: t.stBroadcast,
            detail: transfer?.txHash ? `Tx 0x${shortHash(transfer.txHash, 10, 8)}` : undefined,
            state: st(3),
          },
          {
            label: t.stConfirm,
            detail: transfer?.block ? `#${transfer.block.toLocaleString("en-US")} · ${conf}/3 confirmations` : undefined,
            state: st(4),
          },
          { label: t.stLedger, detail: step > 5 ? t.stLedgerDone : undefined, state: st(5) },
        ]}
      />
    </Modal>
  );
}

// ── 작은 조각들 ─────────────────────────────────────





function NetCard({
  selected,
  onClick,
  title,
  desc,
  icon,
  badge,
  econier,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  icon: React.ReactNode;
  badge?: string;
  econier?: boolean;
}) {
  return (
    <button
      className={`netcard ${selected ? "is-sel" : ""} ${econier ? "netcard--econier" : ""}`}
      onClick={onClick}
      type="button"
    >
      <span className="netcard__radio" />
      <span className="netcard__icon">{icon}</span>
      <span className="netcard__text">
        <span className="netcard__title">
          {title} {badge && <span className="netcard__badge">{badge}</span>}
        </span>
        <span className="netcard__desc">{desc}</span>
      </span>
    </button>
  );
}

function Calc({
  label,
  value,
  strong,
  econier,
  warn,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  econier?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="calc__row">
      <span className="calc__label">{label}</span>
      <span
        className={[
          "calc__value",
          strong ? "is-strong" : "",
          econier ? "is-econier" : "",
          warn ? "is-warn" : "",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function CmpRow({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr>
      <th>{label}</th>
      <td>{a}</td>
      <td className="cmp__econier">{b}</td>
    </tr>
  );
}


function StatusChip({ status, label }: { status: Transfer["status"]; label: string }) {
  const tone =
    status === "transit"
      ? "warn"
      : status === "processing" || status === "broadcast"
        ? "pending"
        : status === "paid"
          ? "paid"
          : "ok";
  return (
    <span className={`chip chip--${tone}`}>
      {tone === "pending" && <span className="spinner spinner--xs" />} {label}
    </span>
  );
}
