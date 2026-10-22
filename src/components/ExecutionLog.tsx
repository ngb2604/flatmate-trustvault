import {
  FileWarning,
  Fingerprint,
  Gavel,
  HandCoins,
  Link2,
  LockKeyhole,
  PenLine,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { clockTime, money } from "../lib/format";
import { shortHash } from "../lib/crypto";
import { cn } from "../lib/cx";
import type { LogEntry, LogKind } from "../types";
import { CopyButton, Panel, PanelHeader, Pill } from "./ui";

const KIND_STYLES: Record<
  LogKind,
  { icon: LucideIcon; iconTone: string; actor: string }
> = {
  session: {
    icon: Fingerprint,
    iconTone: "text-cyan-300",
    actor: "text-cyan-300/80",
  },
  vault: {
    icon: LockKeyhole,
    iconTone: "text-emerald-300",
    actor: "text-emerald-300/80",
  },
  blocked: {
    icon: ShieldAlert,
    iconTone: "text-red-300",
    actor: "text-red-300/80",
  },
  claim: {
    icon: FileWarning,
    iconTone: "text-amber-300",
    actor: "text-amber-300/80",
  },
  sign: {
    icon: PenLine,
    iconTone: "text-violet-300",
    actor: "text-violet-300/80",
  },
  authority: {
    icon: Zap,
    iconTone: "text-emerald-300",
    actor: "text-emerald-300/80",
  },
  payout: {
    icon: HandCoins,
    iconTone: "text-cyan-300",
    actor: "text-cyan-300/80",
  },
  dispute: {
    icon: Gavel,
    iconTone: "text-amber-300",
    actor: "text-amber-300/80",
  },
  reset: {
    icon: RotateCcw,
    iconTone: "text-slate-400",
    actor: "text-slate-400",
  },
};

export function ExecutionLog({ log }: { log: LogEntry[] }) {
  return (
    <Panel testId="execution-log">
      <PanelHeader
        icon={Link2}
        tone="slate"
        title="Execution log"
        subtitle="Tamper-evident audit chain · newest first"
        right={
          <div className="flex items-center gap-2">
            <Pill tone="emerald" icon={ShieldCheck}>
              chain intact
            </Pill>
            <CopyButton
              value={JSON.stringify(log, null, 2)}
              label="Copy full audit trail"
            />
          </div>
        }
      />

      <div className="scroll-slim max-h-[360px] overflow-y-auto">
        {log.length === 0 ? (
          <div className="px-4 py-10 text-center text-[12px] text-slate-400">
            No events yet.
          </div>
        ) : (
          log.map((entry) => {
            const style = KIND_STYLES[entry.kind];
            const Icon = style.icon;

            return (
              <div
                key={entry.id}
                className="group relative flex gap-3 border-b border-white/[0.04] px-4 py-3 transition-colors last:border-0 hover:bg-white/[0.025] sm:px-5"
              >
                <div className="relative flex flex-col items-center">
                  <Icon
                    size={14}
                    strokeWidth={2}
                    className={cn("mt-0.5 shrink-0", style.iconTone)}
                  />
                  <span className="mt-1.5 w-px flex-1 bg-white/[0.06]" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[13px] font-medium text-slate-100">
                      {entry.title}
                    </span>
                    {entry.amountCents ? (
                      <span className="rounded bg-white/[0.05] px-1.5 py-px font-mono text-[11px] text-slate-300">
                        {money(entry.amountCents)}
                      </span>
                    ) : null}
                    <span className="ml-auto font-mono text-[11px] text-slate-400">
                      {clockTime(entry.at)}
                    </span>
                  </div>

                  <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                    {entry.detail}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-slate-400">
                    <span className={style.actor}>{entry.actor}</span>
                    <span className="text-slate-600">/</span>
                    <span title={entry.hash} className="hover:text-slate-300">
                      hash {shortHash(entry.hash)}
                    </span>
                    {entry.signature ? (
                      <>
                        <span className="text-slate-600">/</span>
                        <span
                          title={entry.signature}
                          className="hover:text-slate-300"
                        >
                          sig {entry.signature.slice(0, 12)}…
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.04] px-4 py-2.5 sm:px-5">
        <span className="font-mono text-[11px] text-slate-400">
          {log.length} event{log.length === 1 ? "" : "s"} · SHA-256 chained
        </span>
        <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
          <Link2 size={10} />
          prev-hash linked
        </span>
      </div>
    </Panel>
  );
}
