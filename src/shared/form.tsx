import type { ReactNode } from "react";

export function Fieldset({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="fs">
      <legend className="fs__legend">{title}</legend>
      {children}
    </fieldset>
  );
}

export function Field({
  label,
  value,
  mono,
  strong,
  econier,
  select,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  strong?: boolean;
  econier?: boolean;
  select?: boolean;
}) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <span
        className={[
          "field__value",
          mono ? "mono" : "",
          strong ? "is-strong" : "",
          econier ? "is-econier" : "",
          select ? "is-select" : "",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

export function SumRow({
  k,
  v,
  mono,
  strong,
  econier,
}: {
  k: string;
  v: ReactNode;
  mono?: boolean;
  strong?: boolean;
  econier?: boolean;
}) {
  return (
    <div className="summary__row">
      <dt>{k}</dt>
      <dd className={[mono ? "mono" : "", strong ? "is-strong" : "", econier ? "is-econier" : ""].join(" ")}>{v}</dd>
    </div>
  );
}

export function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="meta">
      <span className="meta__label">{label}</span>
      <span className={`meta__value ${mono ? "mono" : ""}`}>{value}</span>
    </div>
  );
}

export function ToolBtn({ icon, children }: { icon: string; children: string }) {
  return (
    <button className="toolbtn">
      <span className="toolbtn__icon">{icon}</span>
      {children}
    </button>
  );
}
