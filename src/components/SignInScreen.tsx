import {
  ArrowRight,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Server,
  ShieldCheck,
} from "lucide-react";
import { PERSONAS } from "../data/personas";
import { permissionsFor } from "../tidecloak/policy";
import type { ConnectionInfo, PersonaId } from "../types";
import { Avatar } from "./ui";

export function SignInScreen({
  connection,
  busy,
  message,
  realmMode,
  onSignIn,
}: {
  connection: ConnectionInfo;
  busy: boolean;
  message: string;
  realmMode: "demo" | "live";
  onSignIn: (id: PersonaId) => void;
}) {
  return (
    <div
      data-testid="signin"
      className="flex min-h-screen items-start justify-center px-4 py-8 sm:items-center sm:px-6 sm:py-10"
    >
      <div className="w-full max-w-[980px]">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400/10">
            <ShieldCheck
              className="text-emerald-300"
              size={20}
              strokeWidth={1.9}
            />
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold text-white">
              Flatmate TrustVault
            </p>
            <p className="text-[12px] text-slate-400">
              TideCloak Challenge 2 · shared bond escrow
            </p>
          </div>
          <div className="ml-auto hidden items-center gap-2 text-[11px] text-slate-400 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {connection.mode === "live" ? "Live realm" : "Demo realm"} ·{" "}
            {connection.realm}
          </div>
        </div>

        <div className="grid overflow-hidden rounded-xl bg-[#0b1017] lg:grid-cols-[1.02fr_1fr]">
          <div className="p-6 sm:p-8">
            <h1 className="max-w-[420px] text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[34px]">
              Sign in to the bond
            </h1>
            <p className="mt-3 max-w-[420px] text-[13px] leading-relaxed text-slate-300">
              Four identities protect one $1,200 rental deposit. Sign in to
              receive a server-verified ES256 session scoped to your role.
            </p>

            <div className="mt-6 space-y-3">
              {[
                {
                  icon: KeyRound,
                  title: "Private keys never leave this tab",
                  detail:
                    "Non-extractable ECDSA P-256 keys sign every approval locally.",
                },
                {
                  icon: Server,
                  title: "Every API call is verified server-side",
                  detail:
                    "Bearer JWT signature, expiry and Realm Roles are checked before any write.",
                },
                {
                  icon: LockKeyhole,
                  title: "Sensitive records are ciphertext-only",
                  detail:
                    "Bank details and notes are AES-256-GCM encrypted in the browser.",
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-2.5">
                  <item.icon
                    size={15}
                    className="mt-0.5 shrink-0 text-emerald-300/80"
                  />
                  <div>
                    <div className="text-[12px] font-medium text-slate-100">
                      {item.title}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                      {item.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg bg-[#10161f] p-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Realm</span>
                <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px]">
                  {realmMode === "live" ? "LIVE OIDC" : "DEMO IDP"}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-200">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <span className="min-w-0 flex-1 break-all">
                  {connection.issuer}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>TideCloak SDK {connection.sdkVersion}</span>
                <span className="font-mono">{realmMode === "live" ? "OIDC" : "demo"}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                {connection.note}
              </p>
            </div>
          </div>

          <div className="border-t border-white/[0.06] p-4 sm:p-6 lg:border-l lg:border-t-0">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-slate-100">
                {realmMode === "live"
                  ? "TideCloak identity provider"
                  : "Demo identity provider"}
              </h2>
              <span className="font-mono text-[11px] text-slate-400">
                4 identities
              </span>
            </div>

            <div className="space-y-2">
              {PERSONAS.map((persona) => {
                const access = permissionsFor(persona.role);
                return (
                  <button
                    key={persona.id}
                    type="button"
                    disabled={busy}
                    data-testid={`signin-${persona.id}`}
                    onClick={() => onSignIn(persona.id)}
                    className="group flex w-full items-center gap-3 rounded-lg bg-[#10161f] p-3 text-left transition-colors hover:bg-[#151c27] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Avatar persona={persona} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold text-white">
                          {persona.name}
                        </span>
                        <span className="rounded bg-white/[0.06] px-1.5 py-px font-mono text-[11px] text-slate-400">
                          {persona.role}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-400">
                        {persona.roleLabel} ·{" "}
                        {access.fileClaim ? "file claims" : "co-sign claims"} ·
                        no fund access
                      </div>
                    </div>
                    <ArrowRight
                      size={14}
                      className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white"
                    />
                  </button>
                );
              })}
            </div>

            <details
              open
              className="mt-3 rounded-lg bg-[#10161f] px-3 py-2"
            >
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-slate-300">
                <Fingerprint size={11} className="text-emerald-300/70" />
                Judge quick-login credentials
                <span className="ml-auto font-mono text-[11px] text-slate-400">
                  demo realm
                </span>
              </summary>
              <div className="mt-2 space-y-1 border-t border-white/[0.06] pt-2">
                {PERSONAS.map((persona) => (
                  <div
                    key={persona.id}
                    className="flex items-center justify-between font-mono text-[11px]"
                  >
                    <span className="text-slate-300">
                      {persona.id}@trustvault.demo
                    </span>
                    <span className="text-slate-400">
                      {realmMode === "demo" ? "no password" : "realm password"}
                    </span>
                  </div>
                ))}
                <p className="pt-1 text-[11px] leading-relaxed text-slate-400">
                  Demo IdP: click an identity above. A live TideCloak realm uses
                  the usernames and passwords provisioned in that realm.
                </p>
              </div>
            </details>

            <div className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
              <KeyRound size={12} className="mt-0.5 shrink-0" />
              {realmMode === "live"
                ? "Registration, password policy and SSO are delegated to the live TideCloak realm."
                : "The demo realm seeds four identities and issues server-signed sessions; a provisioned TideCloak realm can replace it for production SSO."}{" "}
              This build verifies real ES256 JWTs on the server for every
              request.
            </div>

            <p
              className={
                busy
                  ? "mt-3 text-[12px] text-emerald-300"
                  : "mt-3 text-[11px] text-slate-400"
              }
              aria-live="polite"
            >
              {message}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-1.5 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>No password stored. No master key. No funds move at sign-in.</p>
          <p className="flex items-center gap-1.5">
            <LockKeyhole size={11} />
            Keys non-extractable · tokens memory only · PII ciphertext-only
          </p>
        </div>
      </div>
    </div>
  );
}
