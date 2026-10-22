import {
  ArrowRight,
  Camera,
  Check,
  CircleDollarSign,
  Clock,
  FileWarning,
  Fingerprint,
  Gavel,
  HandCoins,
  ImageIcon,
  LockKeyhole,
  PenLine,
  ReceiptText,
  RotateCcw,
  Scale,
  ShieldCheck,
  Upload,
  UserCheck,
  X,
  Zap,
} from "lucide-react";
import {
  ACCENTS,
  DEFAULT_CLAIM_REASON,
  DEFAULT_EVIDENCE,
  TENANT_IDS,
  personaById,
} from "../data/personas";
import { clockTime, money } from "../lib/format";
import { cn } from "../lib/cx";
import type { ConsensusSnapshot } from "../tidecloak/policy";
import type {
  AppState,
  Claim,
  Decision,
  PersonaDefinition,
  PersonaId,
} from "../types";
import { Avatar, Panel, PanelHeader, Pill } from "./ui";
import { useEffect, useRef, useState } from "react";

type VaultStatus = "protected" | "pending" | "settled" | "disputed";


function SignTag({
  tone,
  children,
  icon: Icon,
}: {
  tone: "emerald" | "red" | "amber" | "slate";
  children: React.ReactNode;
  icon: typeof Check;
}) {
  const styles = {
    emerald: "bg-emerald-400/10 text-emerald-300",
    red: "bg-red-400/10 text-red-300",
    amber: "bg-amber-400/10 text-amber-300",
    slate: "bg-white/[0.06] text-slate-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium",
        styles[tone],
      )}
    >
      <Icon size={11} strokeWidth={2.4} />
      {children}
    </span>
  );
}

function SignatureRow({
  persona,
  status,
  fingerprint,
  signature,
  timestamp,
  active,
  busy,
  onSign,
  onSwitch,
  roleLabel,
}: {
  persona: PersonaDefinition;
  status: "approved" | "rejected" | "awaiting" | "creator";
  fingerprint: string;
  signature?: string;
  timestamp?: number;
  active: boolean;
  busy: boolean;
  onSign?: (decision: Decision) => void;
  onSwitch?: (id: PersonaId) => void;
  roleLabel: string;
}) {
  return (
    <div
      data-testid={`sig-row-${persona.id}`}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
        status === "approved" || status === "creator"
          ? "bg-emerald-400/[0.055]"
          : status === "rejected"
            ? "bg-red-400/[0.055]"
            : active
              ? "bg-white/[0.06]"
              : "bg-[#10161f]",
      )}
    >
      <Avatar persona={persona} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-slate-100">
            {persona.name}
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            {roleLabel}
          </span>
          {active ? (
            <span className="rounded bg-white/[0.08] px-1 py-px text-[11px] font-medium text-slate-300">
              you
            </span>
          ) : null}
        </div>
        <div
          className="mt-0.5 truncate font-mono text-[11px] text-slate-400"
          title={signature ?? fingerprint}
        >
          0x{fingerprint.slice(0, 8)}…{fingerprint.slice(-6)}
          {signature ? ` · sig ${signature.slice(0, 10)}…` : ""}
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {status === "creator" ? (
          <>
            <SignTag tone="emerald" icon={Check}>
              Claim signed
            </SignTag>
            {timestamp ? (
              <span className="hidden font-mono text-[11px] text-slate-400 sm:inline">
                {clockTime(timestamp)}
              </span>
            ) : null}
          </>
        ) : status === "approved" ? (
          <SignTag tone="emerald" icon={Check}>
            Approved
          </SignTag>
        ) : status === "rejected" ? (
          <SignTag tone="red" icon={X}>
            Rejected
          </SignTag>
        ) : active && onSign ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSign("approve")}
              data-testid={`sign-${persona.id}`}
              className="flex h-9 items-center gap-1 rounded-lg bg-emerald-400/10 px-2.5 text-[12px] font-semibold text-emerald-200 transition hover:bg-emerald-400/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PenLine size={11} />
              Sign &amp; approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSign("reject")}
              data-testid={`reject-${persona.id}`}
              className="flex h-9 items-center gap-1 rounded-lg bg-red-400/10 px-2.5 text-[12px] font-medium text-red-300 transition hover:bg-red-400/15 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={11} />
              Reject
            </button>
          </>
        ) : onSwitch ? (
          <button
            type="button"
            onClick={() => onSwitch(persona.id)}
            className="flex h-9 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-[12px] text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
          >
            <UserCheck size={11} />
            Switch to {persona.name}
          </button>
        ) : (
          <SignTag tone="slate" icon={Clock}>
            Awaiting
          </SignTag>
        )}
      </div>
    </div>
  );
}

function PayoutRow({
  persona,
  amount,
  label,
  tone,
}: {
  persona: PersonaDefinition;
  amount: number;
  label: string;
  tone: "emerald" | "amber";
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-[#10161f] px-2.5 py-2">
      <Avatar persona={persona} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-slate-100">
          {persona.name}
        </div>
        <div className="text-[11px] text-slate-400">{label}</div>
      </div>
      <div
        className={cn(
          "font-display text-[14px] font-semibold tabular",
          tone === "emerald" ? "text-emerald-300" : "text-amber-300",
        )}
      >
        +{money(amount)}
      </div>
    </div>
  );
}

function ClaimSummary({
  claim,
  totalCents,
}: {
  claim: Claim;
  totalCents: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-amber-400/[0.05] p-3">
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone="amber" icon={FileWarning}>
              Deduction claim
            </Pill>
            <span className="font-mono text-[11px] text-slate-400">
              {claim.id}
            </span>
            <span className="text-[11px] text-slate-400">
              · filed {clockTime(claim.filedAt)}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-[28px] font-semibold leading-none tracking-tight text-white">
              {money(claim.amountCents)}
            </span>
            <span className="text-[12px] text-slate-400">
              of {money(totalCents)} vault
            </span>
          </div>
          <p className="mt-1.5 line-clamp-2 max-w-[340px] text-[13px] leading-relaxed text-slate-300">
            {claim.reason}
          </p>
          <div
            className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-slate-400"
            title={claim.evidenceHash}
          >
            <Fingerprint size={11} className="text-amber-300/70" />
            evidence 0x{claim.evidenceHash.slice(0, 12)}…
          </div>
        </div>

        <a
          href={claim.evidenceUrl}
          target="_blank"
          rel="noreferrer"
          className="group relative w-[104px] shrink-0 overflow-hidden rounded-lg bg-black/40 sm:w-[128px]"
          title="Open evidence"
        >
          <img
            src={claim.evidenceUrl}
            alt="Claim evidence"
            className="h-[74px] w-full object-cover opacity-90 transition group-hover:opacity-100"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/75 px-1.5 py-1">
            <Camera size={11} className="shrink-0 text-amber-300/80" />
            <span className="truncate font-mono text-[11px] text-slate-300">
              {claim.evidenceName}
            </span>
          </div>
        </a>
      </div>
    </div>
  );
}

export function SettlementPanel({
  state,
  status,
  consensus,
  activePersona,
  busy,
  onFileClaim,
  onSign,
  onDispute,
  onReset,
  onSwitch,
}: {
  state: AppState;
  status: VaultStatus;
  consensus: ConsensusSnapshot | null;
  activePersona: PersonaDefinition;
  busy: boolean;
  onFileClaim: (
    amountCents: number,
    reason: string,
    evidenceUrl: string,
    evidenceName: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  onSign: (decision: Decision) => Promise<void>;
  onDispute: () => Promise<void>;
  onReset: () => void;
  onSwitch: (id: PersonaId) => void;
}) {
  const [amount, setAmount] = useState("150");
  const [reason, setReason] = useState(DEFAULT_CLAIM_REASON);
  const [evidenceUrl, setEvidenceUrl] = useState(DEFAULT_EVIDENCE);
  const [evidenceName, setEvidenceName] = useState("broken_faucet.jpg");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const claim = state.claim;
  const isLandlord = activePersona.id === "bay";

  const handleFile = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid deduction amount.");
      return;
    }

    setSubmitting(true);
    const result = await onFileClaim(
      Math.round(parsed * 100),
      reason.trim() || DEFAULT_CLAIM_REASON,
      evidenceUrl,
      evidenceName,
    );
    setSubmitting(false);
    if (!result.ok) setError(result.error ?? "Claim could not be filed.");
  };

  const handleEvidence = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setEvidenceUrl(url);
    setEvidenceName(file.name);
    if (fileRef.current) fileRef.current.value = "";
  };

  const headerBadge =
    status === "pending" ? (
      <Pill tone="amber" icon={Clock} dot>
        Claim pending
      </Pill>
    ) : status === "settled" ? (
      <Pill tone="emerald" icon={Zap}>
        Authority used
      </Pill>
    ) : status === "disputed" ? (
      <Pill tone="amber" icon={Gavel}>
        Dispute lock
      </Pill>
    ) : (
      <Pill tone="emerald" icon={Scale}>
        2/3 policy
      </Pill>
    );

  return (
    <Panel
      className="flex h-full flex-col"
      testId="settlement-panel"
    >
      <PanelHeader
        icon={ReceiptText}
        tone={status === "pending" ? "amber" : "emerald"}
        title="Move-out settlement"
        subtitle={
          status === "settled"
            ? "Consensus reached · funds distributed"
            : status === "disputed"
              ? "Partial freeze · arbitration pending"
              : "One evidence-backed claim, co-signed by tenants"
        }
        right={headerBadge}
      />

      <div className="flex-1 p-4 sm:p-5 sm:pt-4">
        {!claim ? (
          <div className="grid gap-4 lg:grid-cols-[1.12fr_1fr]">
            <form onSubmit={handleFile} className="min-w-0">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-slate-100">
                  File a deduction claim
                </h3>
                <span className="font-mono text-[11px] text-slate-400">
                  landlord only
                </span>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div>
                  <label
                    htmlFor="claim-amount"
                    className="mb-1 block text-[12px] text-slate-400"
                  >
                    Amount
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-display text-[13px] text-slate-400">
                      $
                    </span>
                    <input
                      id="claim-amount"
                      type="number"
                      min={1}
                      max={state.vault.totalCents / 100}
                      step={1}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className="h-10 w-full rounded-lg bg-[#10161f] pl-7 pr-10 font-display text-[15px] font-semibold tabular text-white transition focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                      usd
                    </span>
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-[12px] text-slate-400">
                    Quick
                  </span>
                  <div className="flex gap-1">
                    {[100, 150, 300].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAmount(String(value))}
                        className={cn(
                          "h-10 rounded-lg px-2.5 font-mono text-[12px] transition",
                          amount === String(value)
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] hover:text-white",
                        )}
                      >
                        ${value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label
                htmlFor="claim-reason"
                className="mb-1 mt-3 block text-[12px] text-slate-400"
              >
                Reason
              </label>
              <textarea
                id="claim-reason"
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full resize-none rounded-lg bg-[#10161f] px-3 py-2.5 text-[13px] leading-relaxed text-slate-200 transition focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
              />

              <div className="mt-3">
                <span className="mb-1 block text-[12px] text-slate-400">
                  Evidence
                </span>
                <div className="flex items-center gap-2 rounded-lg bg-[#10161f] p-2">
                  <img
                    src={evidenceUrl}
                    alt="Evidence preview"
                    className="h-10 w-14 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[12px] text-slate-200">
                      <ImageIcon size={11} className="text-amber-300/80" />
                      <span className="truncate">{evidenceName}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      Photo hashed into the claim
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-[12px] text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
                  >
                    <Upload size={11} />
                    Replace
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleEvidence}
                    className="hidden"
                  />
                </div>
              </div>

              {error ? (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-400/[0.08] px-2.5 py-2 text-[12px] leading-relaxed text-red-300">
                  <X size={12} className="mt-0.5 shrink-0" />
                  {error}
                </p>
              ) : null}

              <div className="mt-3">
                {isLandlord ? (
                  <button
                    type="submit"
                    disabled={submitting || busy}
                    data-testid="claim-submit"
                    className="group flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-400 px-3 text-[13px] font-semibold text-[#04110c] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileWarning size={13} />
                    {submitting ? "Signing claim…" : "Submit claim with evidence"}
                    <ArrowRight
                      size={12}
                      className="transition group-hover:translate-x-0.5"
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSwitch("bay")}
                    data-testid="claim-switch-landlord"
                    className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[13px] font-medium text-slate-200 transition hover:bg-white/[0.1] hover:text-white"
                  >
                    <UserCheck size={13} />
                    Switch to Mr. Bảy to file this claim
                  </button>
                )}
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <LockKeyhole size={11} />
                  Filing is only a proposal. It cannot move a single dollar.
                </p>
              </div>
            </form>

            <div className="space-y-2.5">
              <div className="rounded-lg bg-[#10161f] p-3">
                <div className="label">How authority emerges</div>
                <div className="mt-3 space-y-0">
                  {[
                    {
                      icon: FileWarning,
                      title: "Landlord files evidence",
                      detail: "Signed claim, amount and photo.",
                    },
                    {
                      icon: PenLine,
                      title: "2 of 3 tenants co-sign",
                      detail: "Each in their own session.",
                    },
                    {
                      icon: Zap,
                      title: "Vault releases once",
                      detail: "Then the authority disappears.",
                    },
                  ].map((step, index, list) => (
                    <div key={step.title} className="relative flex gap-2.5 pb-3.5 last:pb-0">
                      {index < list.length - 1 ? (
                        <span className="absolute left-[6px] top-5 h-[calc(100%-16px)] w-px bg-white/[0.08]" />
                      ) : null}
                      <step.icon
                        size={13}
                        className="relative z-10 mt-0.5 shrink-0 text-emerald-300/80"
                      />
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-slate-100">
                          {step.title}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                          {step.detail}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-amber-400/[0.05] p-3">
                <div className="flex items-center gap-1.5">
                  <Gavel size={13} className="text-amber-300/80" />
                  <span className="text-[12px] font-semibold text-amber-200">
                    Dispute path
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">
                  If 2 of 3 tenants reject, the undisputed{" "}
                  <span className="text-white">$1,050</span> is refunded
                  immediately. Only the disputed{" "}
                  <span className="text-amber-300">$150</span> is frozen.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDispute()}
                  data-testid="claim-dispute"
                  className="mt-2.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-amber-400/10 px-3 text-[12px] font-semibold text-amber-200 transition hover:bg-amber-400/15 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Gavel size={12} />
                  Trigger dispute · 2/3 reject
                </button>
                <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
                  Demo shortcut: files the $150 claim and signs two rejections.
                </p>
              </div>
            </div>
          </div>
        ) : status === "pending" ? (
          <div>
            <ClaimSummary claim={claim} totalCents={state.vault.totalCents} />

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <PenLine size={12} className="text-slate-400" />
                <span className="label">Signature checklist</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                landlord + 2 of 3
              </span>
            </div>

            <div className="mt-1.5 space-y-1.5">
              <SignatureRow
                persona={personaById("bay")}
                roleLabel="landlord"
                status="creator"
                fingerprint={claim.landlordFingerprint}
                signature={claim.landlordSignature}
                timestamp={claim.filedAt}
                active={activePersona.id === "bay"}
                busy={busy}
              />
              {TENANT_IDS.map((tenantId) => {
                const persona = personaById(tenantId);
                const approval = claim.approvals[tenantId];
                return (
                  <SignatureRow
                    key={tenantId}
                    persona={persona}
                    roleLabel={persona.role === "tenant_lead" ? "lead" : "tenant"}
                    status={
                      approval
                        ? approval.decision === "approve"
                          ? "approved"
                          : "rejected"
                        : "awaiting"
                    }
                    fingerprint={
                      approval
                        ? approval.fingerprint
                        : state.fingerprints[persona.id]
                    }
                    signature={approval?.signature}
                    timestamp={approval?.signedAt}
                    active={activePersona.id === persona.id}
                    busy={busy}
                    onSign={onSign}
                    onSwitch={onSwitch}
                  />
                );
              })}
            </div>

            {consensus ? (
              <div className="mt-4 rounded-lg bg-[#10161f] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Scale size={12} className="text-slate-400" />
                    <span className="label">Tenant consensus</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-[15px] font-semibold text-white">
                      {consensus.approvals}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      / 2 required
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-1">
                  {TENANT_IDS.map((tenantId) => {
                    const persona = personaById(tenantId);
                    const approval = claim.approvals[tenantId];
                    return (
                      <div
                        key={tenantId}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-500",
                          approval?.decision === "approve" &&
                            "bg-emerald-400",
                          approval?.decision === "reject" && "bg-red-400/70",
                          !approval && "bg-white/[0.08]",
                        )}
                        title={`${persona.name}: ${
                          approval
                            ? approval.decision
                            : "awaiting signature"
                        }`}
                      />
                    );
                  })}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                  <span
                    className={
                      consensus.thresholdMet
                        ? "text-emerald-300"
                        : "text-slate-300"
                    }
                  >
                    {consensus.thresholdMet
                      ? "Threshold met"
                      : `${consensus.remaining} more signature required`}
                  </span>
                  <span className="text-slate-400">
                    {consensus.rejections} of 2 rejection locks · 2/3 policy
                  </span>
                </div>

                <div className="mt-2.5 flex items-center gap-1 border-t border-white/[0.06] pt-2.5 text-[11px] text-slate-400">
                  <LockKeyhole size={11} />
                  Vault stays locked. $0.00 has moved.
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onDispute()}
                    data-testid="claim-dispute-inline"
                    className="ml-auto flex h-8 items-center gap-1 rounded-md bg-amber-400/[0.08] px-2 text-[11px] font-medium text-amber-300 transition hover:bg-amber-400/[0.14] hover:text-amber-200 disabled:opacity-50"
                  >
                    <Gavel size={10} />
                    Trigger dispute
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : status === "settled" ? (
          <div>
            <div
              data-testid="authority-banner"
              className="relative overflow-hidden rounded-xl bg-emerald-400/[0.07] p-4"
            >
              <div className="flex items-start gap-3">
                <Zap size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <div className="text-[12px] font-semibold text-emerald-300">
                    ⚡ Authority emerged
                  </div>
                  <h3 className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.01em] text-white">
                    Emergent Authority unlocked
                  </h3>
                  <p className="mt-1.5 max-w-[420px] text-[13px] leading-relaxed text-emerald-100/75">
                    Landlord + 2/3 tenants aligned
                    {claim.settledAt ? ` at ${clockTime(claim.settledAt)}` : ""}.
                    One atomic settlement — then the authority dissolved.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {[...state.payouts]
                .sort((a, b) =>
                  a.kind === "compensation" ? -1 : b.kind === "compensation" ? 1 : 0,
                )
                .map((payout) => (
                  <PayoutRow
                    key={payout.personaId}
                    persona={personaById(payout.personaId)}
                    amount={payout.amountCents}
                    label={payout.label}
                    tone={payout.kind === "compensation" ? "amber" : "emerald"}
                  />
                ))}
            </div>

            <div className="mt-3 grid grid-cols-3 divide-x divide-white/[0.06] rounded-lg bg-[#10161f] py-3">
              <div className="px-3">
                <div className="label">Released</div>
                <div className="mt-1 font-display text-[14px] font-semibold text-white">
                  {money(state.vault.initialTotalCents)}
                </div>
              </div>
              <div className="px-3">
                <div className="label">To landlord</div>
                <div className="mt-1 font-display text-[14px] font-semibold text-amber-300">
                  {money(claim.amountCents)}
                </div>
              </div>
              <div className="px-3">
                <div className="label">To tenants</div>
                <div className="mt-1 font-display text-[14px] font-semibold text-emerald-300">
                  {money(state.vault.initialTotalCents - claim.amountCents)}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-400/[0.05] px-3 py-2.5">
              <ShieldCheck
                size={14}
                className="mt-0.5 shrink-0 text-emerald-400/80"
              />
              <p className="text-[12px] leading-relaxed text-slate-300">
                <span className="font-medium text-emerald-300">
                  Policy receipt {claim.id}
                </span>{" "}
                — landlord signature + {consensus?.approvals ?? 2} tenant
                approvals verified. Authority was valid for one settlement,
                then revoked.
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck size={12} className="text-emerald-400/70" />
                Refund never entered the lead tenant’s wallet.
              </p>
              <button
                type="button"
                onClick={onReset}
                className="ml-auto flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[12px] text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
              >
                <RotateCcw size={12} />
                Run again
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div
              data-testid="dispute-banner"
              className="relative overflow-hidden rounded-xl bg-amber-400/[0.07] p-4"
            >
              <div className="flex items-start gap-3">
                <Gavel size={20} className="mt-0.5 shrink-0 text-amber-300" />
                <div>
                  <div className="text-[12px] font-semibold text-amber-300">
                    ⚖ Dispute lock engaged
                  </div>
                  <h3 className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.01em] text-white">
                    Partial freeze protected the group
                  </h3>
                  <p className="mt-1.5 max-w-[420px] text-[13px] leading-relaxed text-amber-100/75">
                    2 of 3 tenants rejected the claim. The undisputed balance
                    was refunded instantly — only the disputed amount waits for
                    arbitration.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-[1.35fr_1fr]">
              <div className="rounded-lg bg-[#10161f] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <HandCoins size={12} className="text-emerald-300/80" />
                    <span className="label">Refunded now</span>
                  </div>
                  <span className="font-display text-[14px] font-semibold text-emerald-300">
                    {money(state.vault.initialTotalCents - claim.amountCents)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {state.payouts.map((payout) => (
                    <div
                      key={payout.personaId}
                      className="flex items-center gap-1.5 text-[12px]"
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          ACCENTS[personaById(payout.personaId).accent].solid,
                        )}
                      />
                      <span className="text-slate-300">
                        {personaById(payout.personaId).name}
                      </span>
                      <span className="ml-auto font-mono text-emerald-300/90">
                        +{money(payout.amountCents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-amber-400/[0.06] p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <LockKeyhole size={12} className="text-amber-300/80" />
                  <span className="label">Frozen for arbitration</span>
                </div>
                <div className="font-display text-[20px] font-semibold text-amber-300">
                  {money(state.vault.frozenCents)}
                </div>
                <div className="mt-2 space-y-1 font-mono text-[11px] leading-relaxed text-slate-400">
                  <div>case arb_{claim.id.slice(-6)}</div>
                  <div>neutral panel · no landlord key</div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-400/[0.05] px-3 py-2.5">
              <Gavel size={14} className="mt-0.5 shrink-0 text-amber-300/80" />
              <p className="text-[12px] leading-relaxed text-slate-300">
                <span className="font-medium text-amber-300">
                  Case arb_{claim.id.slice(-6)}
                </span>{" "}
                — two tenant rejections engaged the freeze. The landlord’s
                evidence is retained for the neutral TideCloak panel.
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <CircleDollarSign size={12} className="text-slate-400" />
                Landlord wallet received $0.00 · no penalty applied.
              </p>
              <button
                type="button"
                onClick={onReset}
                className="ml-auto flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[12px] text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
              >
                <RotateCcw size={12} />
                Run again
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-2.5 sm:px-5">
        <span className="font-mono text-[11px] text-slate-400">
          {claim ? claim.id : "no active claim"}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
          <ShieldCheck size={11} className="text-slate-400" />
          policy tide.bond.release.v1
        </span>
      </div>
    </Panel>
  );
}
