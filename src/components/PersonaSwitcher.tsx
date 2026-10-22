import { Check, ChevronRight, Fingerprint, Users } from "lucide-react";
import { ACCENTS, PERSONAS, personaById } from "../data/personas";
import { moneyWhole } from "../lib/format";
import { cn } from "../lib/cx";
import type { PersonaId } from "../types";
import { Avatar } from "./ui";

export function PersonaSwitcher({
  activeId,
  onSwitch,
}: {
  activeId: PersonaId;
  onSwitch: (id: PersonaId) => void;
}) {
  return (
    <section className="mt-5" aria-label="Active persona">
      <div className="mb-2.5 flex items-center justify-between gap-3 px-0.5">
        <div className="flex items-center gap-2 text-[12px] font-medium text-slate-400">
          <Users size={13} className="text-slate-500" />
          Switch active session
          <span className="hidden rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px] text-slate-400 sm:inline">
            {personaById(activeId).role}
          </span>
        </div>
        <div className="hidden items-center gap-1.5 text-[12px] text-slate-400 sm:flex">
          <Fingerprint size={12} />
          4 identities bound · ECDSA P-256
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {PERSONAS.map((persona) => {
          const active = persona.id === activeId;
          const accent = ACCENTS[persona.accent];

          return (
            <button
              key={persona.id}
              type="button"
              onClick={() => onSwitch(persona.id)}
              aria-pressed={active}
              data-testid={`persona-${persona.id}`}
              className={cn(
                "group relative overflow-hidden rounded-xl p-2.5 text-left transition-colors duration-150 sm:p-3",
                active
                  ? "bg-[#141c27]"
                  : "bg-[#0b1017] hover:bg-[#10161f]",
              )}
            >
              {active ? (
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 w-0.5",
                    accent.solid,
                  )}
                />
              ) : null}

              <div className="relative flex items-center gap-2 sm:gap-2.5">
                <div className="relative">
                  <Avatar
                    persona={persona}
                    size="md"
                    className="h-8 w-8 sm:h-10 sm:w-10"
                  />
                  {active ? (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 ring-2 ring-[#141c27]">
                      <Check size={8} strokeWidth={3} className="text-[#05070b]" />
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-[13px] font-semibold",
                        active ? "text-white" : "text-slate-200",
                      )}
                    >
                      {persona.name}
                    </span>
                    {active ? (
                      <span className="rounded bg-white/[0.08] px-1 py-px text-[11px] font-medium text-slate-300">
                        active
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-[11px] text-slate-400">
                    <span className={cn("truncate", active ? accent.text : "")}>
                      {persona.roleLabel}
                    </span>
                    <span className="hidden text-slate-600 sm:inline">·</span>
                    <span className="hidden truncate sm:inline">
                      {persona.kind === "tenant"
                        ? `${moneyWhole(persona.contributionCents)} bond`
                        : "claim creator"}
                    </span>
                  </div>
                </div>

                <ChevronRight
                  size={14}
                  className={cn(
                    "hidden shrink-0 transition sm:block",
                    active
                      ? cn("opacity-80", accent.text)
                      : "text-slate-600 group-hover:translate-x-0.5 group-hover:text-slate-400",
                  )}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
