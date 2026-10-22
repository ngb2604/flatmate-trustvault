import { RotateCcw, ShieldCheck } from "lucide-react";
import type { ConnectionInfo } from "../types";

export function Header({
  connection,
  onReset,
  busy,
}: {
  connection: ConnectionInfo;
  onReset: () => void;
  busy: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 bg-[#05070b]">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10">
            <ShieldCheck className="text-emerald-300" size={19} strokeWidth={1.9} />
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

        <div className="ml-4 hidden items-center gap-2 border-l border-white/[0.08] pl-4 lg:flex">
          <span className="text-[12px] text-slate-400">
            TideCloak Challenge 2
          </span>
          <span className="rounded-md bg-white/[0.05] px-2 py-1 font-mono text-[12px] text-slate-300">
            no master key
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div
            title={connection.note}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-400/[0.07] px-2 py-1.5 sm:gap-2 sm:px-2.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
            <div className="whitespace-nowrap leading-tight">
              <div className="text-[12px] font-medium text-emerald-200">
                TideCloak
                <span className="ml-1.5 hidden font-normal text-emerald-300/70 sm:inline">
                  {connection.mode === "live" ? "live realm" : "demo realm"}
                </span>
              </div>
              <div className="hidden text-[11px] text-emerald-300/70 sm:block">
                connected · verified sessions
              </div>
            </div>
          </div>

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
            <span className="hidden sm:inline">Reset demo</span>
          </button>
        </div>
      </div>
    </header>
  );
}
