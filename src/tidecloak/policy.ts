import type { SignedApproval, TenantId, TideRole } from "../types";
import { CONSENSUS_THRESHOLD, TENANT_COUNT } from "../data/personas";

export const RELEASE_POLICY = {
  id: "tide.bond.release.v1",
  label: "Shared bond release",
  version: "1.0",
  requirement: "Landlord + 2 of 3 tenants",
  tenantThreshold: CONSENSUS_THRESHOLD,
  tenantCount: TENANT_COUNT,
  landlordSignatures: 1,
  masterKey: false,
  arbitration: "TideCloak neutral arbitration pool",
} as const;

export interface PolicyEvaluation {
  allowed: boolean;
  code: "NO_MASTER_KEY" | "MISSING_CONSENSUS" | "CONSENSUS_REACHED";
  status: 200 | 403;
  title: string;
  detail: string;
  policy: string;
}

export interface ConsensusSnapshot {
  approvals: number;
  rejections: number;
  undecided: number;
  thresholdMet: boolean;
  rejectionLock: boolean;
  remaining: number;
  progress: number;
}

export interface RolePermissions {
  readVault: true;
  fileClaim: boolean;
  signClaim: boolean;
  moveFunds: false;
}

/**
 * Role access is derived from the token's role, never from UI state alone.
 * No role can move funds: release is a policy decision, not an account right.
 */
export function permissionsFor(role: TideRole): RolePermissions {
  return {
    readVault: true,
    fileClaim: role === "landlord",
    signClaim: role === "tenant_lead" || role === "tenant_member",
    moveFunds: false,
  };
}

export function consensusFrom(
  approvals: Partial<Record<TenantId, SignedApproval>>,
): ConsensusSnapshot {
  const entries = Object.values(approvals).filter(
    (entry): entry is SignedApproval => Boolean(entry),
  );
  const approved = entries.filter(
    (entry) => entry.decision === "approve" && entry.verified,
  ).length;
  const rejected = entries.filter(
    (entry) => entry.decision === "reject" && entry.verified,
  ).length;

  return {
    approvals: approved,
    rejections: rejected,
    undecided: TENANT_COUNT - entries.length,
    thresholdMet: approved >= CONSENSUS_THRESHOLD,
    rejectionLock: rejected > TENANT_COUNT / 3,
    remaining: Math.max(0, CONSENSUS_THRESHOLD - approved),
    progress: Math.min(100, (approved / CONSENSUS_THRESHOLD) * 100),
  };
}

export function unilateralWithdrawalBlocked(): PolicyEvaluation {
  return {
    allowed: false,
    code: "NO_MASTER_KEY",
    status: 403,
    title: "TIDECLOAK POLICY VIOLATION · 403",
    detail:
      "No master key exists. The escrow vault has no unilateral withdrawal path. Release requires 1 landlord + 2 of 3 tenant signatures.",
    policy: RELEASE_POLICY.id,
  };
}

export function forceDeductionBlocked(): PolicyEvaluation {
  return {
    allowed: false,
    code: "MISSING_CONSENSUS",
    status: 403,
    title: "TIDECLOAK POLICY VIOLATION · 403",
    detail:
      "Force-deduct rejected: 0 of 2 required tenant signatures. Landlord custody is proposal-only — funding authority never sits with one party.",
    policy: RELEASE_POLICY.id,
  };
}

export function consensusReached(): PolicyEvaluation {
  return {
    allowed: true,
    code: "CONSENSUS_REACHED",
    status: 200,
    title: "EMERGENT AUTHORITY UNLOCKED",
    detail:
      "Landlord claim + 2/3 tenant signatures verified. Authority emerged for one atomic settlement and immediately dissolved.",
    policy: RELEASE_POLICY.id,
  };
}
