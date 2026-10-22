import { useState, type ReactNode } from "react";
import { Check, Copy, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cx";
import type { PersonaDefinition } from "../types";

export function Panel({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className?: string;
  glow?: "emerald" | "red";
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className={cn("panel", className)}
    >
      {children}
    </section>
  );
}

const headerTones: Record<string, string> = {
  emerald: "text-emerald-300",
  violet: "text-violet-300",
  cyan: "text-cyan-300",
  amber: "text-amber-300",
  red: "text-red-300",
  slate: "text-slate-400",
};

export function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  right,
  tone = "emerald",
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  tone?: keyof typeof headerTones;
}) {
  return (
    <div className="flex items-start gap-2.5 px-4 pb-3 pt-4 sm:px-5">
      <Icon
        size={16}
        strokeWidth={1.9}
        className={cn("mt-0.5 shrink-0", headerTones[tone])}
      />
      <div className="min-w-0 flex-1">
        <h2 className="text-[16px] font-semibold leading-tight text-white">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-[12px] leading-snug text-slate-400">
            {subtitle}
          </p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

const pillTones: Record<string, string> = {
  emerald: "bg-emerald-400/10 text-emerald-300",
  amber: "bg-amber-400/10 text-amber-300",
  red: "bg-red-400/10 text-red-300",
  slate: "bg-white/[0.06] text-slate-300",
  cyan: "bg-cyan-400/10 text-cyan-300",
  violet: "bg-violet-400/10 text-violet-300",
};

export function Pill({
  children,
  tone = "slate",
  icon: Icon,
  dot,
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof pillTones;
  icon?: LucideIcon;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-medium",
        pillTones[tone],
        className,
      )}
    >
      {dot ? (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "emerald" && "animate-pulse-dot bg-emerald-400",
            tone === "amber" && "bg-amber-400",
            tone === "red" && "bg-red-400",
            tone === "cyan" && "bg-cyan-400",
            tone === "violet" && "bg-violet-400",
            tone === "slate" && "bg-slate-400",
          )}
        />
      ) : null}
      {Icon ? <Icon size={11} strokeWidth={2.2} /> : null}
      {children}
    </span>
  );
}

const avatarSizes: Record<string, string> = {
  xs: "h-6 w-6 rounded-md text-[12px]",
  sm: "h-8 w-8 rounded-lg text-[12px]",
  md: "h-10 w-10 rounded-lg text-[13px]",
  lg: "h-12 w-12 rounded-lg text-[15px]",
};

const avatarTones: Record<string, string> = {
  emerald: "bg-emerald-400/15 text-emerald-200",
  violet: "bg-violet-400/15 text-violet-200",
  cyan: "bg-cyan-400/15 text-cyan-200",
  amber: "bg-amber-400/15 text-amber-200",
};

export function Avatar({
  persona,
  size = "md",
  className,
}: {
  persona: PersonaDefinition;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center font-semibold tracking-wide",
        avatarSizes[size],
        avatarTones[persona.accent] ?? "bg-white/10 text-slate-200",
        className,
      )}
    >
      {persona.initials}
    </div>
  );
}

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.05] text-slate-400 transition hover:bg-white/10 hover:text-white",
        copied && "bg-emerald-400/10 text-emerald-300",
        className,
      )}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export function MetaRow({
  label,
  value,
  mono = true,
  title,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] text-slate-400">{label}</span>
      <span
        title={title}
        className={cn(
          "max-w-[65%] truncate text-right text-[12px] text-slate-300",
          mono && "mono",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-white/[0.06]", className)} />;
}
