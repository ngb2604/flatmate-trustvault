import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useTrustVault } from "./hooks/useTrustVault";
import { PERSONAS } from "./data/personas";
import { Header } from "./components/Header";
import { SignInScreen } from "./components/SignInScreen";
import { PersonaSwitcher } from "./components/PersonaSwitcher";
import { VaultPanel } from "./components/VaultPanel";
import { SessionPolicyCard } from "./components/SessionPolicyCard";
import { AttackSimulator } from "./components/AttackSimulator";
import { SettlementPanel } from "./components/SettlementPanel";
import { DataProtectionPanel } from "./components/DataProtectionPanel";
import { ExecutionLog } from "./components/ExecutionLog";
import { BootScreen } from "./components/BootScreen";
import { money } from "./lib/format";

export default function App() {
  const vault = useTrustVault();
  const autoSignedIn = useRef(false);

  useEffect(() => {
    if (!vault.connection || vault.signedIn || autoSignedIn.current) return;
    const requested = new URLSearchParams(window.location.search).get("as");
    if (!requested) return;
    const persona = PERSONAS.find((candidate) => candidate.id === requested);
    if (!persona) return;
    autoSignedIn.current = true;
    void vault.signIn(persona.id);
  }, [vault.connection, vault.signedIn, vault.signIn]);

  if (vault.booting || !vault.connection) {
    return <BootScreen message={vault.bootMessage} error={vault.bootError} />;
  }

  if (!vault.signedIn || !vault.state) {
    return (
      <SignInScreen
        connection={vault.connection}
        busy={vault.busy}
        message={vault.authMessage}
        realmMode={vault.realm?.loginMode ?? "demo"}
        onSignIn={(id) => void vault.signIn(id)}
      />
    );
  }

  const { state } = vault;

  const lockedCents =
    vault.status === "settled"
      ? state.vault.initialTotalCents
      : vault.status === "disputed"
        ? state.vault.frozenCents
        : state.vault.totalCents;

  return (
    <div className="min-h-screen bg-[#05070b]">
      <Header
        connection={state.connection}
        persona={vault.activePersona}
        session={vault.activeSession ?? null}
        onSignOut={vault.signOut}
        onReset={() => void vault.resetDemo()}
        busy={vault.busy}
      />

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 pb-4 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[30px]">
              Shared bond escrow
            </h1>
            <p className="mt-1.5 max-w-[560px] text-[13px] leading-relaxed text-slate-400">
              Four identities, one {money(state.vault.initialTotalCents)} bond.
              Release requires the landlord plus two of three tenants — no
              master key exists.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-slate-400 sm:justify-end">
            <span>
              {money(lockedCents)}{" "}
              {vault.status === "settled"
                ? "distributed"
                : vault.status === "disputed"
                  ? "frozen for arbitration"
                  : "locked"}
            </span>
            <span className="hidden text-slate-600 sm:inline">|</span>
            <span>4 identities bound</span>
            <span className="hidden text-slate-600 sm:inline">|</span>
            <span>2/3 tenant threshold</span>
          </div>
        </div>

        {vault.bootError ? (
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-400/[0.08] px-3 py-2 text-[12px] text-red-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span className="flex-1">{vault.bootError}</span>
            <button
              type="button"
              onClick={vault.clearError}
              className="rounded p-0.5 text-red-300/60 transition hover:text-red-200"
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        ) : null}

        <PersonaSwitcher activeId={state.activeId} onSwitch={vault.switchPersona} />

        <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-12 xl:gap-4">
          <div className="lg:col-span-7 xl:col-span-8">
            <VaultPanel state={state} status={vault.status} />
          </div>

          <div className="lg:col-span-5 xl:col-span-4">
            <SessionPolicyCard
              activePersona={vault.activePersona}
              activeSession={vault.activeSession!}
              activeFingerprint={vault.activeFingerprint!}
              connection={state.connection}
              onSignOut={vault.signOut}
            />
          </div>

          <div className="lg:col-span-5">
            <AttackSimulator
              activeId={state.activeId}
              alert={state.alert}
              busy={vault.busy}
              onWithdraw={() => void vault.attemptUnilateralWithdrawal()}
              onForceDeduct={() => void vault.attemptForceDeduct()}
              onSwitch={vault.switchPersona}
            />
          </div>

          <div className="lg:col-span-7">
            <SettlementPanel
              state={state}
              status={vault.status}
              consensus={vault.consensus}
              activePersona={vault.activePersona}
              busy={vault.busy}
              onFileClaim={vault.fileClaim}
              onSign={vault.signClaim}
              onDispute={vault.runDisputeScenario}
              onReset={() => void vault.resetDemo()}
              onSwitch={vault.switchPersona}
            />
          </div>

          <div className="lg:col-span-12">
            <DataProtectionPanel
              persona={vault.activePersona}
              pii={vault.pii}
              inspector={vault.inspector}
              busy={vault.piiBusy}
              error={vault.piiError}
              claimNote={state.claim?.confidentialNote ?? null}
              onSave={vault.saveProtectedFields}
              onReveal={vault.revealProtectedFields}
              onRefresh={() => void vault.refreshInspector()}
            />
          </div>

          <div className="lg:col-span-12">
            <ExecutionLog log={state.log} />
          </div>
        </div>

        <footer className="mt-8 flex flex-col items-start justify-between gap-1.5 border-t border-white/[0.06] pt-4 text-[12px] text-slate-400 sm:flex-row sm:items-center">
          <p>
            Flatmate TrustVault · RMIT GenAI &amp; Cybersecurity Hackathon 2026 ·
            TideCloak Challenge 2
          </p>
          <p className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
            Server-verified sessions · field-level encrypted records
          </p>
        </footer>
      </main>
    </div>
  );
}
