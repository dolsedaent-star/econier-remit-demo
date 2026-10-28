import { useEffect } from "react";
import { KoreaConsole } from "./kr/KoreaConsole";
import { Launcher } from "./Launcher";
import { setAutoMode } from "./shared/demo";
import { ThaiConsole } from "./th/ThaiConsole";

// 주소창에 은행 업무시스템처럼 보이는 경로를 쓴다
export const ROUTES = {
  th: "/rattana/fcubs/payments/PXOUTRMT",
  kr: "/kbank/fx-ops/FXI2100",
};

const SCREENS = {
  th: {
    title: "PXOUTRMT · Outward Cross-Border Remittance — Rattana Bank Core Banking",
    icon: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' rx='8' fill='%23f3c969'/><path d='M20 6 L31 17 L20 34 L9 17 Z' fill='%236d1a2a'/></svg>`,
  },
  kr: {
    title: "FXI2100 · 타발송금 수취 처리 — 케이뱅크 외환운영시스템",
    icon: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' rx='10' fill='%23141b4d'/><path d='M13 10 V30 M13 21 L25 10 M17 18 L27 30' stroke='white' stroke-width='4.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>`,
  },
};

function resolve(): "th" | "kr" | "home" {
  const path = location.pathname.replace(/\/+$/, "").toLowerCase();
  if (path === "/th" || path === ROUTES.th.toLowerCase()) return "th";
  if (path === "/kr" || path === ROUTES.kr.toLowerCase()) return "kr";
  return "home";
}

export function App() {
  const screen = resolve();

  useEffect(() => {
    // 짧은 주소(/th, /kr)로 들어와도 업무시스템 주소로 바꿔 보여 준다
    if (screen !== "home") {
      const params = new URLSearchParams(location.search);
      if (params.has("auto")) setAutoMode(screen, true);
      history.replaceState(null, "", ROUTES[screen]);
      document.title = SCREENS[screen].title;
      setFavicon(SCREENS[screen].icon);
    } else {
      document.title = "ECONIER · Cross-Border Remittance Demo";
      setFavicon("", "/brand/token-mark.png");
    }
  }, [screen]);

  if (screen === "th") return <ThaiConsole />;
  if (screen === "kr") return <KoreaConsole />;
  return <Launcher />;
}

function setFavicon(svg: string, href?: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href ?? `data:image/svg+xml,${svg}`;
}
