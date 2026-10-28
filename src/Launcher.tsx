import { useState } from "react";
import { ROUTES } from "./App";
import { resetDemo, setAutoMode, useAutoMode, useTransfers } from "./shared/demo";
import { KbankLogo, RattanaLogo } from "./shared/logos";

export function Launcher() {
  const autoTh = useAutoMode("th");
  const autoKr = useAutoMode("kr");
  const transfers = useTransfers();

  const [blocked, setBlocked] = useState(false);

  // 크롬은 클릭 한 번에 팝업을 하나만 허용한다. 두 번째가 막히면 안내를 띄운다
  function open(path: string, side: "left" | "right") {
    const w = Math.floor(screen.availWidth / 2);
    const h = screen.availHeight;
    return window.open(path, side, `popup,width=${w},height=${h},left=${side === "left" ? 0 : w},top=0`);
  }

  return (
    <div className="launcher">
      <div className="launcher__inner">
        <img src="/brand/logo.png" alt="ECONIER" className="launcher__logo" />
        <h1>Cross-Border Remittance Demo</h1>
        <p className="muted">Thailand → Korea · Bank operator screens · SWIFT vs ECONIER Network</p>

        <div className="launcher__cards">
          <a className="launcher__card" href={ROUTES.th} target="_blank" rel="noreferrer">
            <RattanaLogo size={44} />
            <div>
              <b>Rattana Bank · Thailand</b>
              <span>Outward remittance (sender) · EN / ไทย</span>
              <code>{ROUTES.th}</code>
            </div>
          </a>
          <a className="launcher__card" href={ROUTES.kr} target="_blank" rel="noreferrer">
            <KbankLogo size={44} />
            <div>
              <b>K bank · Korea</b>
              <span>Inward remittance (receiver) · 한국어 / EN</span>
              <code>{ROUTES.kr}</code>
            </div>
          </a>
        </div>

        <div className="launcher__actions">
          <button
            className="btn btn--primary btn--econier"
            onClick={() => {
              const a = open(ROUTES.th, "left");
              const b = open(ROUTES.kr, "right");
              setBlocked(!a || !b);
            }}
          >
            Open both side by side
          </button>
          <button className="btn" onClick={() => open(ROUTES.th, "left")}>
            ① Thailand (left)
          </button>
          <button className="btn" onClick={() => open(ROUTES.kr, "right")}>
            ② Korea (right)
          </button>
          <label className="check">
            <input type="checkbox" checked={autoTh} onChange={(e) => setAutoMode("th", e.target.checked)} />
            Auto · Thailand
          </label>
          <label className="check">
            <input type="checkbox" checked={autoKr} onChange={(e) => setAutoMode("kr", e.target.checked)} />
            Auto · Korea
          </label>
          <button className="btn" onClick={resetDemo}>
            Reset demo data ({transfers.length})
          </button>
        </div>

        {blocked && (
          <div className="notice notice--info mt">
            팝업이 차단되어 창 하나만 열렸습니다. 주소창 오른쪽의 팝업 차단 아이콘 → "항상 허용"을 선택한 뒤 다시
            누르거나, ① ② 버튼을 하나씩 누르세요.
          </div>
        )}

        <ol className="launcher__howto">
          <li>Open both screens (two browser windows, side by side).</li>
          <li>
            Thai screen: choose <b>ECONIER Network</b>, enter <b>10,000</b> THB, tick identity check, Submit → Authorize.
          </li>
          <li>Korea screen: the remittance arrives → <b>Confirm Credit</b> → identity check → <b>Cash Payout</b>.</li>
          <li>
            Auto mode: each screen has its own <b>AUTO</b> switch in the status bar (Thai screen also: <b>F9</b>). Turn on
            one or both.
          </li>
        </ol>
      </div>
    </div>
  );
}
