import { AlertTriangle, Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";

export function BootScreen({
  message,
  error,
}: {
  message: string;
  error?: string | null;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-400/10">
          <ShieldCheck
            size={28}
            strokeWidth={1.8}
            className="text-emerald-300"
          />
        </div>

        <p className="mt-5 text-[13px] font-semibold text-slate-400">
          Flatmate
        </p>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-white">
          TrustVault
        </h1>

        {error ? (
          <div className="mt-5 rounded-xl bg-red-400/[0.06] p-4 text-left">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-red-300">
              <AlertTriangle size={13} />
              Realm bootstrap failed
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-red-200/80">
              {error}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
              The demo needs a secure context (localhost or HTTPS) with WebCrypto
              available.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 h-9 w-full rounded-lg bg-white/[0.06] px-3 text-[12px] font-medium text-slate-200 transition hover:bg-white/[0.1]"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <p className="mt-3 text-[12px] text-slate-400">{message}</p>
            <div className="mx-auto mt-4 h-0.5 w-40 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-400" />
            </div>
            <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Fingerprint size={11} /> ES256 keys
              </span>
              <span className="h-3 w-px bg-white/10" />
              <span className="flex items-center gap-1.5">
                <LockKeyhole size={11} /> vault sealed
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
