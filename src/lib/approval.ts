import { RELEASE_POLICY } from "../tidecloak/policy";
import type { Decision, TenantId } from "../types";

/**
 * Canonical payload builders shared by the browser signer and the server
 * verifier. Both sides call these functions, so the JSON field order used for
 * signing is always identical.
 */
export function signingInput(payload: unknown): string {
  return JSON.stringify(payload);
}

export interface FileClaimPayload {
  v: 1;
  policy: string;
  claimId: string;
  amountCents: number;
  decision: "file";
  actor: string;
  at: number;
  evidenceHash: string;
}

export function fileClaimPayload(
  claimId: string,
  amountCents: number,
  at: number,
  evidenceHash: string,
  actor = "bay",
): FileClaimPayload {
  return {
    v: 1,
    policy: RELEASE_POLICY.id,
    claimId,
    amountCents,
    decision: "file",
    actor,
    at,
    evidenceHash,
  };
}

export interface DecisionPayload {
  v: 1;
  policy: string;
  claimId: string;
  amountCents: number;
  decision: Decision;
  tenant: TenantId;
  at: number;
}

export function decisionPayload(
  claimId: string,
  amountCents: number,
  tenant: TenantId,
  decision: Decision,
  at: number,
): DecisionPayload {
  return {
    v: 1,
    policy: RELEASE_POLICY.id,
    claimId,
    amountCents,
    decision,
    tenant,
    at,
  };
}
