import {
  ArrowRight,
  Check,
  LockKeyhole,
  ShieldAlert,
  Terminal,
  UserCheck,
} from "lucide-react";
import { personaById } from "../data/personas";
import { shortSignature } from "../lib/crypto";
import { cn } from "../lib/cx";
import type { AttackAlert, PersonaId } from "../types";
import { Avatar, Panel, PanelHeader, Pill } from "./ui";

export function AttackSimulator({
  activeId,
  alert,
  busy,
  onWithdraw,
  onForceDeduct,
  onSwitch,
}: {
  activeId: PersonaId;
  alert: AttackAlert | null;
  busy: boolean;
  onWithdraw: () => void;
  onForceDeduct: () => void;
  onSwitch: (id: PersonaId) => void;
}) {
  const minh = personaById("minh");
  const bay = personaById("bay");

  const attackButton = (
    requiredId: PersonaId,
    label: string,
    action: () => void,
  ) => {
    if (activeId !== requiredId) {
      const required = personaById(requiredId);
      return (
        <button
          type="button"
          onClick={() => onSwitch(requiredId)}
          data-testid={`switch-attack-${requiredId}`}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-white/[0.05] px-3 text-[12px] font-medium text-slate-300 transition hover:bg-white/[0.09] hover:text-white"
        >
          <UserCheck size={13} />
          Switch to {required.name} to attempt
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={action}
        disabled={busy}
        data-testid={`attack-${requiredId}`}
        className="group flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-red-400/10 px-3 text-[12px] font-semibold text-red-200 transition hover:bg-red-400/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ShieldAlert size={13} />
        {label}
        <ArrowRight
          size={12}
          className="opacity-60 transition group-hover:translate-x-0.5"
        />
      </button>
    );
  };

  return (
    <Panel className="flex h-full flex-col" testId="attack-panel">
      <PanelHeader
        icon={ShieldAlert}
        tone="red"
        title="Unilateral attack simulator"
        subtitle="Give one insider maximum power. Watch the policy refuse."
        right={
          <Pill tone="red" dot>
            Red team
          </Pill>
        }
      />

      <div className="flex flex-1 flex-col p-4 pt-1 sm:p-5 sm:pt-1">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="rounded-lg bg-[#10161f] p-3">
            <div className="flex items-center gap-2">
              <Avatar persona={minh} size="sm" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-slate-100">
                    {minh.name}
                  </span>
                  <span className="rounded bg-white/[0.06] px-1.5 py-px font-mono text-[11px] text-slate-400">
                    lead
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-slate-400">
                  Seize the group bond alone
                </p>
              </div>
            </div>
            <div className="mt-3">
              {attackButton(
                "minh",
                "Withdraw all · $1,200",
                onWithdraw,
              )}
            </div>
          </div>

          <div className="rounded-lg bg-[#10161f] p-3">
            <div className="flex items-center gap-2">
              <Avatar persona={bay} size="sm" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-slate-100">
                    {bay.name}
                  </span>
                  <span className="rounded bg-white/[0.06] px-1.5 py-px font-mono text-[11px] text-slate-400">
                    landlord
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-slate-400">
                  Deduct without tenant consent
                </p>
              </div>
            </div>
            <div className="mt-3">
              {attackButton("bay", "Force deduct · $300", onForceDeduct)}
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-lg bg-[#020407]">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
              <Terminal size={12} />
              tidecloak.policy
            </div>
            <span
              className={cn(
                "font-mono text-[11px]",
                alert ? "text-red-400" : "text-slate-400",
              )}
            >
              {alert ? "403 blocked" : "idle"}
            </span>
          </div>

          <div className="min-h-[150px] px-3 pb-3 font-mono text-[12px] leading-[1.8]">
            {alert ? (
              <div key={alert.id} className="animate-shake space-y-0.5">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-emerald-400/70">POST</span>
                  <span>/vault/release</span>
                  <span className="ml-auto">HTTP/1.1</span>
                </div>
                <div className="text-slate-400">
                  <span className="text-slate-400">&gt; actor</span>{" "}
                  {alert.actor}
                </div>
                <div className="text-slate-400">
                  <span className="text-slate-400">&gt; policy</span>{" "}
                  {alert.policy}
                </div>
                <div className="my-1.5 h-px bg-white/[0.06]" />
                <div className="font-semibold text-red-300">
                  &lt; 403 Forbidden · TIDECLOAK_EMERGENT_AUTHORITY_MISSING
                </div>
                <div className="text-slate-400">
                  &lt; policy_code {alert.code}
                </div>
                <div className="text-slate-300">{alert.detail}</div>
                <div className="truncate text-slate-400">
                  &lt; sig {shortSignature(alert.signature)}
                </div>
                <div className="text-emerald-400/80">
                  &lt; intent + verdict written to audit chain
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-slate-300">
                <div>
                  <span className="text-emerald-400/60">&gt;</span> awaiting
                  adversarial request
                  <span className="animate-pulse text-emerald-300">_</span>
                </div>
                <div>
                  <span className="text-slate-400">policy</span>{" "}
                  tide.bond.release.v1
                </div>
                <div>
                  <span className="text-slate-400">master_key</span> null
                </div>
                <div>
                  <span className="text-slate-400">single_party_authority</span>{" "}
                  <span className="text-red-400/80">impossible</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 text-[12px] text-slate-400">
          {[
            "No admin override",
            "Identity-bound requests",
            "2/3 tenant threshold",
            "SHA-256 audit chain",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-1.5 rounded-md bg-white/[0.035] px-2 py-1.5"
            >
              <Check size={11} className="shrink-0 text-emerald-400/70" />
              <span className="truncate">{item}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-1.5 pt-3 text-[12px] leading-snug text-slate-400">
          <LockKeyhole size={11} className="shrink-0" />
          Every attempt is signed by the active session and appended to the
          tamper-evident log.
        </div>
      </div>
    </Panel>
  );
}
