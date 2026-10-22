"use client";

import { useState } from "react";
import {
  Braces,
  Check,
  Copy,
  LogOut,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { ACCENTS } from "../data/personas";
import { decodeJwt } from "../lib/crypto";
import type { ConnectionInfo, PersonaDefinition, SessionInfo } from "../types";
import { Avatar } from "./ui";

export function Header({
  connection,
  persona,
  session,
  onSignOut,
  onReset,
  busy,
}: {
  connection: ConnectionInfo;
  persona: PersonaDefinition;
  session: SessionInfo | null;
  onSignOut: () => void;
  onReset: () => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const accent = ACCENTS[persona.accent];
  const decoded = session
    ? decodeJwt(session.token)
    : { header: null, payload: null };

  const copyToken = async () => {
    if (!session) return;
    await navigator.clipboard.writeText(session.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#05070b]">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10">
              <ShieldCheck
                className="text-emerald-300"
                size={19}
                strokeWidth={1.9}
              />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em] text-white sm:text-[16px]">
                Flatmate TrustVault
              </p>
              <p className="hidden text-[12px] text-slate-400 sm:block">
                Programmable multi-party escrow
              </p>
            </div>
          </div>

          <div className="ml-4 hidden items-center gap-2 border-l border-white/[0.08] pl-4 xl:flex">
            <span className="text-[12px] text-slate-400">
              TideCloak Challenge 2
            </span>
            <span className="rounded-md bg-white/[0.05] px-2 py-1 font-mono text-[12px] text-slate-300">
              no master key
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <div
              title={session?.claims.sub ?? connection.note}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-white/[0.04] py-1 pl-1 pr-2 sm:pr-2.5"
            >
              <Avatar persona={persona} size="sm" />
              <div className="hidden leading-tight md:block">
                <div className="flex items-center gap-1.5">
                  <span className="max-w-[110px] truncate text-[12px] font-medium text-slate-100">
                    {persona.fullName}
                  </span>
                  <span
                    className={`rounded bg-white/[0.05] px-1 py-px font-mono text-[11px] ${accent.text}`}
                  >
                    {persona.role}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-400">
                  {session?.claims.sub ?? "no session"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={!session}
              data-testid="jwt-button"
              className="flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.05] px-2.5 text-[12px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
              title="Inspect the raw TideCloak JWT"
            >
              <Braces size={13} />
              <span className="hidden sm:inline">JWT</span>
            </button>

            <button
              type="button"
              onClick={onReset}
              disabled={busy}
              data-testid="reset-demo"
              className="group flex h-9 items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 text-[12px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
              title="Reset vault, wallets and claim state"
            >
              <RotateCcw
                size={13}
                className="transition duration-500 group-hover:-rotate-180"
              />
              <span className="hidden xl:inline">Reset demo</span>
            </button>

            <button
              type="button"
              onClick={onSignOut}
              data-testid="header-signout"
              className="flex h-9 items-center gap-1.5 rounded-lg bg-white/[0.05] px-2.5 text-[12px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
              title="Sign out and wipe session tokens"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {open && session ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[8vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Raw TideCloak JWT"
          data-testid="jwt-modal"
        >
          <div className="max-h-[80vh] w-full max-w-[720px] overflow-hidden rounded-xl bg-[#0b1017]">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <Braces size={14} className="text-emerald-300" />
                <h2 className="text-[14px] font-semibold text-white">
                  Raw TideCloak JWT
                </h2>
                <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[11px] text-emerald-300">
                  {session.verified ? "signature verified" : "verification failed"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyToken}
                  className="flex h-8 items-center gap-1.5 rounded-md bg-white/[0.06] px-2.5 text-[11px] text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                  aria-label="Close JWT inspector"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="max-h-[65vh] space-y-3 overflow-auto px-4 pb-4 scroll-slim">
              <div>
                <div className="mb-1 text-[11px] text-slate-400">
                  Compact token (sent as Authorization: Bearer)
                </div>
                <p className="break-all rounded-lg bg-[#020407] p-3 font-mono text-[11px] leading-[1.7] text-slate-300">
                  {session.token}
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <div className="mb-1 text-[11px] text-slate-400">
                    Header
                  </div>
                  <pre className="overflow-auto rounded-lg bg-[#020407] p-3 font-mono text-[11px] leading-relaxed text-emerald-200/90">
                    {JSON.stringify(decoded.header, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="mb-1 text-[11px] text-slate-400">
                    Payload (server-verified)
                  </div>
                  <pre className="max-h-[260px] overflow-auto rounded-lg bg-[#020407] p-3 font-mono text-[11px] leading-relaxed text-slate-300">
                    {JSON.stringify(decoded.payload, null, 2)}
                  </pre>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                The server re-verifies this ES256 signature and its Realm Roles
                on every API request. The token lives in memory only and is
                revoked on sign-out.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
