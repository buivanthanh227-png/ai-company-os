import type { ReactNode } from "react";
import { presenceOf } from "@/lib/engine";
import type { LiveStaff, Presence } from "@/lib/types";
import { PRESENCE_LABEL } from "@/lib/types";
import { cn } from "@/lib/cn";

export function BrandMark() {
  return (
    <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent font-mono text-xs font-semibold text-accent-fg shadow-sm">
      OS
    </span>
  );
}

export function StaffMark({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-subtle font-mono text-xs text-fg">
      {letters || "AI"}
    </span>
  );
}

const PRESENCE_TEXT: Record<Presence, string> = {
  active: "text-ok",
  degraded: "text-warn",
  quota_exhausted: "text-danger",
  offline: "text-muted",
  standby: "text-faint",
};

export function PresenceBadge({ person }: { person: Pick<LiveStaff, "status" | "budget"> }) {
  const presence = presenceOf(person);
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border border-line bg-elevated px-2.5 py-1 text-xs font-medium", PRESENCE_TEXT[presence])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {PRESENCE_LABEL[presence]}
    </span>
  );
}

export function Meter({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));
  const tone = width <= 0 ? "bg-danger" : width < 20 ? "bg-warn" : "bg-accent";
  return (
    <div className="h-2 rounded-full bg-subtle" aria-hidden="true">
      <div className={cn("h-2 rounded-full transition-[width]", tone)} style={{ width: `${width}%` }} />
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  lede,
  actions,
}: {
  kicker: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="font-mono text-xs font-medium tracking-wide text-accent">{kicker}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {lede ? <p className="mt-2 text-base leading-7 text-muted">{lede}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-elevated p-4 shadow-sm">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-fg">{value}</p>
      {hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}
