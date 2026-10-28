// 가상 은행 로고 (실제 은행과 무관)

export function RattanaLogo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="8" fill="#f3c969" />
      <path d="M20 6 L31 17 L20 34 L9 17 Z" fill="#6d1a2a" />
      <path d="M20 6 L25 17 L20 34 L15 17 Z" fill="#9b2d3f" />
      <path d="M9 17 H31" stroke="#f3c969" strokeWidth="1.6" />
    </svg>
  );
}

/** 임시 마크 — 케이뱅크 공식 CI 파일을 받으면 이미지로 교체 */
export function KbankLogo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="10" fill="#fff" />
      <path
        d="M13 10 V30 M13 21 L25 10 M17 18 L27 30"
        stroke="#141b4d"
        strokeWidth="4.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
