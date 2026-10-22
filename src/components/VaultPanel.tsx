import {
  ArrowRight,
  Fingerprint,
  KeyRound,
  Link2,
  LockKeyhole,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { ACCENTS, PERSONAS, tenantPersonas } from "../data/personas";
import { money, moneyWhole, pct } from "../lib/format";
import { cn } from "../lib/cx";
import type { AppState } from "../types";
import { Avatar, Panel, PanelHeader, Pill } from "./ui";

type VaultStatus = "protected" | "pending" | "settled" | "disputed";

function statusPill(status: VaultStatus) {
  if (status === "settled") {
    return (
      <Pill tone="cyan" icon={ShieldCheck} dot>
        Settled
      </Pill>
    );
  }
  if (status === "disputed") {
    return (
      <Pill tone="amber" icon={LockKeyhole} dot>
        Partially frozen
      </Pill>
    );
  }
  if (status === "pending") {
    return (
      <Pill tone="amber" icon={LockKeyhole} dot>
        Claim pending
      </Pill>
    );
  }
  return (
    <Pill tone="emerald" icon={LockKeyhole} dot>
      Protected
    </Pill>
  );
}

export function VaultPanel({
  state,
  status,
}: {
  state: AppState;
  status: VaultStatus;
}) {
  const { vault, wallets, payouts } = state;
  const displayCents =
    status === "settled"
      ? vault.initialTotalCents
      : status === "disputed"
        ? vault.frozenCents
        : vault.totalCents;
  const dollars = Math.floor(displayCents / 100).toLocaleString("en-US");
  const cents = String(displayCents % 100).padStart(2, "0");
  const totalOwnership = tenantPersonas.reduce(
    (sum, persona) => sum + persona.contributionCents,
    0,
  );

  const headline =
    status === "settled"
      ? "Total distributed"
      : status === "disputed"
        ? "Frozen in escrow"
        : "Total locked escrow";

  const caption =
    status === "settled"
      ? "Every dollar routed directly to an individual wallet. The vault is closed."
      : status === "disputed"
        ? "Undisputed funds were refunded. Only the disputed claim stays locked."
        : "Contributed equally by three tenants. No one holds a withdrawal key.";

  return (
    <Panel className="flex h-full flex-col overflow-hidden" testId="vault-panel">
      <PanelHeader
        icon={LockKeyhole}
        title="Escrow vault"
        subtitle="Ownership-aware shared rental bond"
        right={statusPill(status)}
      />

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="label">{headline}</span>
              <span className="rounded-md bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[11px] text-emerald-300/90">
                no master key
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1" data-testid="vault-total">
              <span className="font-display text-[40px] font-semibold leading-none tracking-[-0.03em] text-white">
                ${dollars}
              </span>
              <span className="font-display text-[20px] font-medium text-slate-400">
                .{cents}
              </span>
            </div>
            <p className="mt-2 max-w-[380px] text-[13px] leading-relaxed text-slate-400">
              {caption}
            </p>
          </div>

          <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:flex-col sm:items-end sm:gap-1.5">
            <div className="text-left sm:text-right">
              <div className="text-[12px] text-slate-400">Vault ID</div>
              <div className="mt-0.5 font-mono text-[12px] text-slate-300">
                vault_flat_7a
              </div>
            </div>
            <div className="hidden h-px w-24 bg-white/[0.06] sm:block" />
            <div
              className="flex items-center gap-1 text-[12px] text-slate-400"
              title="The vault is governed by a signature policy, not by an account owner."
            >
              <Fingerprint size={12} className="text-emerald-400/70" />
              policy custody
            </div>
          </div>
        </div>

        <div className="mt-5">
          {status === "settled" ? (
            <div className="flex h-2 items-center overflow-hidden rounded-full bg-emerald-400/10">
              <div className="h-full w-full bg-emerald-400/70" />
            </div>
          ) : status === "disputed" ? (
            <div className="relative flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full w-[87.5%] bg-emerald-400/50" />
              <div className="h-full flex-1 bg-amber-400/70" />
            </div>
          ) : (
            <div className="flex h-2 gap-px overflow-hidden rounded-full bg-white/[0.04]">
              {tenantPersonas.map((persona) => (
                <div
                  key={persona.id}
                  style={{
                    width: `${(persona.contributionCents / totalOwnership) * 100}%`,
                  }}
                  className={cn(
                    "h-full",
                    ACCENTS[persona.accent].solid,
                  )}
                  title={`${persona.name} · ${money(persona.contributionCents)}`}
                />
              ))}
            </div>
          )}

          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {tenantPersonas.map((persona) => (
              <div key={persona.id} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    ACCENTS[persona.accent].solid,
                  )}
                />
                <span className="truncate text-[12px] text-slate-400">
                  {persona.name}
                </span>
                <span className="ml-auto hidden font-mono text-[11px] text-slate-400 sm:inline">
                  {moneyWhole(persona.contributionCents)}
                </span>
                <span className="font-mono text-[12px] text-slate-400">
                  {pct(persona.contributionCents, totalOwnership)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 border-t border-white/[0.05] pt-4">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Wallet size={14} className="text-slate-400" />
              <span className="label">Personal wallets</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <span>settled direct</span>
              <ArrowRight size={10} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {PERSONAS.map((persona) => {
              const accent = ACCENTS[persona.accent];
              const balance = wallets[persona.id];
              const payout = payouts.find(
                (line) =>
                  line.personaId === persona.id && line.kind !== "frozen",
              );

              return (
                <div
                  key={persona.id}
                  data-testid={`wallet-${persona.id}`}
                  className={cn(
                    "relative overflow-hidden rounded-lg p-2.5 transition-colors",
                    payout ? accent.bg : "bg-[#10161f]",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Avatar persona={persona} size="xs" />
                    <span className="truncate text-[12px] font-medium text-slate-300">
                      {persona.name}
                    </span>
                    <span
                      className={cn(
                        "ml-auto h-1.5 w-1.5 shrink-0 rounded-full",
                        balance > 0 ? accent.solid : "bg-slate-700",
                      )}
                    />
                  </div>
                  <div
                    key={balance}
                    data-wallet-balance={balance}
                    className={cn(
                      "mt-2 font-display text-[22px] font-semibold tracking-tight",
                      balance > 0 ? "text-white" : "text-slate-400",
                      payout && "animate-pop",
                    )}
                  >
                    {money(balance)}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-1">
                    <span className="text-[11px] text-slate-400">
                      {persona.kind === "landlord" ? "landlord" : "tenant"}
                    </span>
                    {payout ? (
                      <span
                        className={cn(
                          "font-mono text-[11px] font-medium",
                          accent.text,
                        )}
                      >
                        +{money(payout.amountCents)}
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-slate-600">
                        —
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            {
              icon: Fingerprint,
              label: "Evidence",
              value: "SHA-256 committed",
            },
            {
              icon: KeyRound,
              label: "Private keys",
              value: "Non-extractable",
            },
            {
              icon: Link2,
              label: "Audit trail",
              value: "Hash-chained",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-lg bg-[#0d1219] px-3 py-2"
            >
              <item.icon size={13} className="shrink-0 text-slate-400" />
              <div className="min-w-0">
                <div className="text-[11px] text-slate-400">{item.label}</div>
                <div className="truncate text-[12px] text-slate-200">
                  {item.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-3">
          <div className="grid grid-cols-1 divide-y divide-white/[0.05] rounded-lg bg-[#0d1219] py-1 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:py-2.5">
            {[
              { icon: LockKeyhole, label: "Withdrawal", value: "Consensus only" },
              { icon: Wallet, label: "Refund routing", value: "Direct to wallet" },
              { icon: ShieldCheck, label: "Authority", value: "Computed, burned" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-1.5 px-2.5 py-2 sm:py-0"
              >
                <item.icon size={13} className="shrink-0 text-emerald-400/60" />
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-400">
                    {item.label}
                  </div>
                  <div className="truncate text-[12px] text-slate-200">
                    {item.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between px-0.5 font-mono text-[11px] text-slate-500">
            <span>vault_flat_7a · ownership ledger sealed</span>
            <span className="flex items-center gap-1">
              <ShieldCheck size={10} />
              no admin override
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
}
