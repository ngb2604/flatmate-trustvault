"use client";

import { useEffect, useState } from "react";
import {
  Database,
  Eye,
  FileKey2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { ACCENTS } from "../data/personas";
import type {
  EncryptedField,
  InspectorSnapshot,
  PersonaDefinition,
  PersonaId,
} from "../types";
import { Panel, PanelHeader, Pill } from "./ui";

interface PiiRecord {
  updatedAt: number;
  fields: Record<string, EncryptedField>;
}

const DEMO_PII: Record<
  PersonaId,
  { accountName: string; bankIban: string; nationalId: string }
> = {
  minh: {
    accountName: "Minh Tran",
    bankIban: "VN98-TECHCOMBANK-1903848291",
    nationalId: "STU-2026-1107",
  },
  lan: {
    accountName: "Lan Nguyen",
    bankIban: "VN12-VIETCOMBANK-0048291736",
    nationalId: "STU-2026-1142",
  },
  tuan: {
    accountName: "Tuan Pham",
    bankIban: "VN44-ACB-1903119982",
    nationalId: "STU-2026-1188",
  },
  bay: {
    accountName: "Ong Bay",
    bankIban: "VN71-BIDV-3100992814",
    nationalId: "OWNER-1958-0421",
  },
};

const DEMO_NOTE =
  "Confidential evidence note: plumber invoice #F-2041 confirms the bathroom faucet was leaking before handover. Quoted replacement cost 150.00 USD. Tenant Nguyen acknowledged the quote in the group chat on 18 Oct.";

function ciphertextPreview(field: EncryptedField | null | undefined): string {
  if (!field) return "null";
  return `ENC_TIDE_v1:${field.ciphertext.slice(0, 28)}…`;
}

function InspectorField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="truncate font-mono text-[11px] text-slate-300" title={value}>
        {value}
      </div>
    </div>
  );
}

export function DataProtectionPanel({
  persona,
  pii,
  inspector,
  busy,
  error,
  claimNote,
  onSave,
  onReveal,
  onRefresh,
}: {
  persona: PersonaDefinition;
  pii: PiiRecord | null;
  inspector: InspectorSnapshot | null;
  busy: boolean;
  error: string | null;
  claimNote: EncryptedField | null;
  onSave: (fields: Record<string, string>) => Promise<{
    ok: boolean;
    error?: string;
  }>;
  onReveal: () => Promise<{
    ok: boolean;
    values?: Record<string, string>;
    error?: string;
  }>;
  onRefresh: () => void;
}) {
  const isTenant = persona.kind === "tenant";
  const defaults = DEMO_PII[persona.id];
  const [accountName, setAccountName] = useState(defaults.accountName);
  const [bankIban, setBankIban] = useState(defaults.bankIban);
  const [nationalId, setNationalId] = useState(defaults.nationalId);
  const [note, setNote] = useState(DEMO_NOTE);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const next = DEMO_PII[persona.id];
    setAccountName(next.accountName);
    setBankIban(next.bankIban);
    setNationalId(next.nationalId);
    setNote(DEMO_NOTE);
    setFeedback(null);
    setRevealed(null);
  }, [persona.id]);

  const save = async () => {
    setFeedback(null);
    setRevealed(null);
    const fields: Record<string, string> = isTenant
      ? { accountName, bankIban, nationalId }
      : { confidentialNote: note };
    const result = await onSave(fields);
    setFeedback(
      result.ok
        ? "Encrypted in this tab, stored as ciphertext by the server."
        : (result.error ?? "Encryption failed."),
    );
  };

  const reveal = async () => {
    setFeedback(null);
    const result = await onReveal();
    if (result.ok && result.values) {
      setRevealed(result.values);
      setFeedback("Decrypted locally with the owner's AES key.");
    } else {
      setRevealed(null);
      setFeedback(result.error ?? "Unable to decrypt.");
    }
  };

  const accent = ACCENTS[persona.accent];
  const fieldCount = pii ? Object.keys(pii.fields).length : 0;

  return (
    <Panel testId="data-panel">
      <PanelHeader
        icon={ShieldCheck}
        title="Data protection"
        subtitle="TideCloak field-level encryption · the server stores ciphertext only"
        right={
          <Pill tone="emerald" icon={LockKeyhole}>
            AES-256-GCM
          </Pill>
        }
      />

      <div className="grid gap-3 px-4 pb-4 pt-1 sm:px-5 lg:grid-cols-2">
        <div className="rounded-lg bg-[#10161f] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <FileKey2 size={13} className="text-emerald-300/80" />
              <h3 className="text-[12px] font-semibold text-slate-100">
                {isTenant ? "Refund & identity records" : "Confidential evidence note"}
              </h3>
            </div>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${accent.bg} ${accent.text}`}
            >
              {persona.role}
            </span>
          </div>

          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            {isTenant
              ? "Bank account, IBAN and national / student ID are encrypted with a non-extractable AES key before they leave this tab."
              : "The dispute note is encrypted in this browser. Only the landlord identity can decrypt it; the server and other roles only see ciphertext."}
          </p>

          <div className="mt-3 space-y-2">
            {isTenant ? (
              <>
                <label className="block">
                  <span className="text-[11px] text-slate-400">
                    Account holder
                  </span>
                  <input
                    value={accountName}
                    onChange={(event) => setAccountName(event.target.value)}
                    className="mt-1 h-8 w-full rounded-md bg-[#020407] px-2.5 font-mono text-[12px] text-slate-200 outline-none focus:ring-1 focus:ring-emerald-400/40"
                    data-testid="pii-account-name"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-400">
                    Refund IBAN
                  </span>
                  <input
                    value={bankIban}
                    onChange={(event) => setBankIban(event.target.value)}
                    className="mt-1 h-8 w-full rounded-md bg-[#020407] px-2.5 font-mono text-[12px] text-slate-200 outline-none focus:ring-1 focus:ring-emerald-400/40"
                    data-testid="pii-iban"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-400">
                    National / student ID
                  </span>
                  <input
                    value={nationalId}
                    onChange={(event) => setNationalId(event.target.value)}
                    className="mt-1 h-8 w-full rounded-md bg-[#020407] px-2.5 font-mono text-[12px] text-slate-200 outline-none focus:ring-1 focus:ring-emerald-400/40"
                    data-testid="pii-national-id"
                  />
                </label>
              </>
            ) : (
              <label className="block">
                <span className="text-[11px] text-slate-400">
                  Evidence description · encrypted before filing
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={5}
                  className="mt-1 w-full resize-none rounded-md bg-[#020407] p-2.5 text-[12px] leading-relaxed text-slate-200 outline-none focus:ring-1 focus:ring-amber-400/40"
                  data-testid="pii-note"
                />
              </label>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              data-testid="pii-save"
              className="flex h-8 items-center gap-1.5 rounded-md bg-emerald-400/15 px-3 text-[11px] font-medium text-emerald-200 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LockKeyhole size={11} />
              {busy ? "Encrypting…" : "Encrypt & save"}
            </button>
            <button
              type="button"
              onClick={() => void reveal()}
              disabled={!pii}
              data-testid="pii-reveal"
              className="flex h-8 items-center gap-1.5 rounded-md bg-white/[0.06] px-3 text-[11px] font-medium text-slate-300 transition hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Eye size={11} />
              Reveal (owner only)
            </button>
            {pii ? (
              <span className="font-mono text-[11px] text-slate-400">
                {fieldCount} sealed field{fieldCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          {error ? (
            <p className="mt-2 rounded-md bg-red-400/[0.08] px-2 py-1.5 text-[11px] text-red-300">
              {error}
            </p>
          ) : null}
          {feedback ? (
            <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
              {feedback}
            </p>
          ) : null}

          {revealed ? (
            <div className="mt-2 rounded-md bg-emerald-400/[0.06] p-2">
              <div className="mb-1 text-[11px] text-emerald-200">
                Decrypted locally · owner view
              </div>
              {Object.entries(revealed).map(([name, value]) => (
                <div key={name} className="font-mono text-[11px] text-slate-200">
                  <span className="text-slate-400">{name}:</span> {value}
                </div>
              ))}
            </div>
          ) : null}

          {pii ? (
            <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-2">
              <div className="mb-1 flex items-center gap-1 text-[11px] text-slate-400">
                <LockKeyhole size={10} />
                Stored envelope
              </div>
              {Object.entries(pii.fields).map(([name, field]) => (
                <div key={name} className="min-w-0">
                  <span className="text-[11px] text-slate-400">{name}: </span>
                  <span className="break-all font-mono text-[11px] text-emerald-200/80">
                    {ciphertextPreview(field)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 border-t border-white/[0.06] pt-2 text-[11px] text-slate-400">
              No protected record yet for {persona.name}. Encrypt the demo fields
              to write a ciphertext-only row.
            </p>
          )}
        </div>

        <div className="rounded-lg bg-[#020407] p-3" data-testid="inspector-panel">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Database size={13} className="text-cyan-300/80" />
              <h3 className="text-[12px] font-semibold text-slate-100">
                Database inspector
              </h3>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              data-testid="inspector-refresh"
              className="flex h-7 items-center gap-1 rounded-md bg-white/[0.05] px-2 text-[11px] text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
            >
              <RefreshCw size={10} />
              Refresh
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            What the server / cloud admin sees in the JSON ledger.
          </p>

          {inspector ? (
            <div className="mt-2 max-h-[360px] space-y-2.5 overflow-auto pr-1 scroll-slim">
              <div className="rounded-md bg-[#0b1017] p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-slate-300">
                    {inspector.file}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {inspector.fileBytes.toLocaleString()} bytes
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  realm kid {inspector.realm.kid} · {inspector.realm.alg} ·
                  private key {inspector.realm.privateKey}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] text-slate-400">
                  deposits[].payoutRef · {inspector.deposits.length} rows
                </div>
                <div className="space-y-1">
                  {inspector.deposits.map((deposit) => (
                    <div
                      key={deposit.sub}
                      className="rounded-md bg-[#0b1017] px-2 py-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-slate-300">
                          {deposit.sub}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          ${(deposit.amountCents / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-0.5 break-all font-mono text-[11px] text-emerald-200/70">
                        {ciphertextPreview(deposit.payoutRef)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] text-slate-400">
                  protected_pii · {inspector.pii.length} record
                  {inspector.pii.length === 1 ? "" : "s"}
                </div>
                {inspector.pii.length === 0 ? (
                  <div className="rounded-md bg-[#0b1017] px-2 py-1.5 font-mono text-[11px] text-slate-400">
                    {"{} · nothing stored yet"}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {inspector.pii.map((record) => (
                      <div
                        key={record.sub}
                        className="rounded-md bg-[#0b1017] px-2 py-1.5"
                      >
                        <div className="font-mono text-[11px] text-slate-300">
                          {record.sub} · {record.personaId}
                        </div>
                        {Object.entries(record.fields).map(([name, field]) => (
                          <div
                            key={name}
                            className="mt-0.5 break-all font-mono text-[11px] text-emerald-200/70"
                          >
                            {name}: {ciphertextPreview(field)}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <InspectorField
                  label="claim.confidentialNote"
                  value={ciphertextPreview(claimNote)}
                />
                <InspectorField
                  label="users / revoked sessions"
                  value={`${inspector.users.length} / ${inspector.sessions.revoked}`}
                />
              </div>

              <div>
                <div className="mb-1 text-[11px] text-slate-400">
                  users[] · public key registry
                </div>
                {inspector.users.map((user) => (
                  <div
                    key={user.sub}
                    className="flex items-center justify-between gap-2 rounded-md bg-[#0b1017] px-2 py-1"
                  >
                    <span className="truncate font-mono text-[11px] text-slate-300">
                      {user.sub} · {user.role}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      0x{user.fingerprint.slice(0, 8)}…
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-md bg-[#0b1017] p-2 text-[11px] text-slate-400">
              Sign in to load the server-side record.
            </div>
          )}

          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            Every value above is either a public identifier or AES-GCM
            ciphertext. The plaintext bank details never reach this file; the
            browser-held key is required to reveal them.
          </p>
        </div>
      </div>
    </Panel>
  );
}
