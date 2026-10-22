import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  LogOut,
  Radio,
  Scale,
  ShieldCheck,
  X,
} from "lucide-react";
import { ACCENTS } from "../data/personas";
import { RELEASE_POLICY, permissionsFor } from "../tidecloak/policy";
import { tokenExpiry } from "../lib/format";
import { cn } from "../lib/cx";
import type {
  ConnectionInfo,
  PersonaDefinition,
  SessionInfo,
} from "../types";
import { Avatar, CopyButton, Panel, PanelHeader, Pill } from "./ui";

function RuleNode({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "emerald" | "amber";
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-2 py-2 text-center",
        tone === "emerald" && "bg-emerald-400/10",
        tone === "amber" && "bg-amber-400/[0.07]",
        tone === "slate" && "bg-[#151c27]",
      )}
    >
      <div className="text-[11px] text-slate-400">{label}</div>
      <div
        className={cn(
          "mt-0.5 font-mono text-[12px] font-medium",
          tone === "emerald" ? "text-emerald-300" : "text-slate-200",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function SessionPolicyCard({
  activePersona,
  activeSession,
  activeFingerprint,
  connection,
  onSignOut,
}: {
  activePersona: PersonaDefinition;
  activeSession: SessionInfo;
  activeFingerprint: string;
  connection: ConnectionInfo;
  onSignOut: () => void;
}) {
  const accent = ACCENTS[activePersona.accent];
  const claims = activeSession.claims;
  const access = permissionsFor(claims.role);
  const shortSub = `${claims.sub.slice(0, 12)}…${claims.sub.slice(-4)}`;

  return (
    <Panel className="h-full" testId="session-panel">
      <PanelHeader
        icon={Fingerprint}
        title="TideCloak session"
        subtitle="Browser-held identity · role-bound token"
        right={
          <Pill
            tone={activeSession.verified ? "emerald" : "red"}
            icon={CheckCircle2}
          >
            {activeSession.verified ? "Verified" : "Invalid"}
          </Pill>
        }
      />

      <div className="p-4 pt-2 sm:p-5 sm:pt-2">
        <div className="flex items-center gap-2.5 rounded-lg bg-[#10161f] p-3">
          <Avatar persona={activePersona} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold text-white">
                {activePersona.fullName}
              </span>
              <ShieldCheck size={13} className="shrink-0 text-emerald-400" />
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={cn(
                  "rounded px-1.5 py-px font-mono text-[11px]",
                  accent.bg,
                  accent.text,
                )}
              >
                {activePersona.role}
              </span>
              <span className="truncate text-[11px] text-slate-400">
                {activePersona.roleLabel}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400">key</div>
            <div
              className="mt-0.5 font-mono text-[11px] text-slate-300"
              title={activeFingerprint}
            >
              0x{activeFingerprint.slice(0, 4)}…{activeFingerprint.slice(-4)}
            </div>
          </div>
        </div>

        <div
          data-testid="session-access"
          className="mt-2.5 rounded-lg bg-white/[0.03] p-2.5"
        >
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <KeyRound size={11} />
            Session access
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded bg-emerald-400/10 px-1.5 py-1 text-[11px] text-emerald-300">
              <ShieldCheck size={10} />
              read vault
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-emerald-400/10 px-1.5 py-1 text-[11px] text-emerald-300">
              <ShieldCheck size={10} />
              {access.fileClaim ? "file claims" : "co-sign claims"}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-red-400/10 px-1.5 py-1 text-[11px] text-red-300">
              <X size={10} />
              no fund access
            </span>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-lg bg-[#020407]">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1.5 text-slate-400">
              <KeyRound size={12} />
              <span className="font-mono text-[11px]">access token</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-emerald-400/80">
                ES256
              </span>
              <CopyButton
                value={activeSession.token}
                label="Copy TideCloak access token"
              />
            </div>
          </div>
          <p
            data-testid="session-token"
            data-scope={claims.scope}
            className="break-all px-3 pb-2 font-mono text-[11px] leading-[1.7] text-slate-400"
          >
            {activeSession.token.slice(0, 96)}
            <span className="text-slate-400">…</span>
          </p>
          <div className="grid grid-cols-3 divide-x divide-white/[0.06] bg-white/[0.02]">
            <div className="px-2.5 py-2">
              <div className="text-[11px] text-slate-400">sub</div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-slate-300">
                {shortSub}
              </div>
            </div>
            <div className="px-2.5 py-2">
              <div className="text-[11px] text-slate-400">role</div>
              <div
                className={cn("mt-0.5 truncate font-mono text-[11px]", accent.text)}
              >
                {claims.role}
              </div>
            </div>
            <div className="px-2.5 py-2">
              <div className="text-[11px] text-slate-400">exp</div>
              <div className="mt-0.5 font-mono text-[11px] text-slate-300">
                {tokenExpiry(claims.exp)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-emerald-400/[0.045] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Scale size={12} className="text-emerald-300/80" />
              <span className="text-[12px] font-semibold text-emerald-200">
                Release policy
              </span>
            </div>
            <span className="truncate font-mono text-[11px] text-slate-400">
              {RELEASE_POLICY.id}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1">
            <RuleNode label="Landlord" value="1 sig" />
            <span className="text-[11px] text-slate-400">+</span>
            <RuleNode label="Tenants" value="2 of 3" />
            <ArrowRight size={12} className="text-slate-400" />
            <RuleNode label="Vault" value="releases" tone="emerald" />
          </div>

          <p className="mt-2.5 text-[11px] leading-relaxed text-slate-300">
            Authority is computed at settlement time, then dissolved. It is
            never stored on an account.
          </p>

          <div className="mt-2.5 flex items-center gap-1.5 border-t border-white/[0.08] pt-2.5">
            <Ban size={12} className="text-red-400/80" />
            <span className="text-[11px] text-red-300">Master key</span>
            <span className="ml-auto font-mono text-[11px] text-red-300/80">
              none
            </span>
          </div>
        </div>

        <div className="mt-3 flex min-w-0 items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-2 text-[11px] text-slate-400">
          <Radio size={11} className="shrink-0 text-emerald-400/70" />
          <span
            className="min-w-0 flex-1 truncate"
            title={`${connection.issuer} · @tidecloak/js ${connection.sdkVersion}`}
          >
            TideCloak SDK {connection.sdkVersion}
          </span>
          <LockKeyhole size={11} className="ml-auto shrink-0" />
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">
            Private keys non-extractable
          </span>
          <button
            type="button"
            onClick={onSignOut}
            data-testid="sign-out"
            className="flex h-8 items-center gap-1.5 rounded-md bg-white/[0.05] px-2.5 text-[11px] font-medium text-slate-300 transition hover:bg-white/[0.09] hover:text-white"
          >
            <LogOut size={11} />
            Sign out
          </button>
        </div>
      </div>
    </Panel>
  );
}
