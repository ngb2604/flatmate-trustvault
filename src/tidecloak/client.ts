import type { ConnectionInfo, PersonaDefinition } from "../types";

export interface TideCloakAdapterConfig {
  url: string;
  realm: string;
  clientId: string;
  redirectUri?: string;
  silentCheckSsoRedirectUri?: string;
}

declare global {
  interface Window {
    __TIDECLOAK__?: TideCloakAdapterConfig;
  }
}

export const TIDECLOAK_SDK_VERSION = "0.14.41";

export interface RealmPolicy {
  id: string;
  label: string;
  version: string;
  requirement: string;
  tenantThreshold: number;
  tenantCount: number;
  landlordSignatures: number;
  masterKey: boolean;
  arbitration: string;
}

export interface RealmInfo {
  connection: ConnectionInfo;
  policy: RealmPolicy;
  sessionTtlSeconds: number;
  loginMode: "demo" | "live";
  loginUrl: string | null;
  personas: Array<
    Pick<
      PersonaDefinition,
      "id" | "name" | "fullName" | "initials" | "role" | "roleLabel" | "kind"
    > & { contributionCents: number }
  >;
}

export function readTideCloakConfig(): TideCloakAdapterConfig | null {
  if (typeof window !== "undefined" && window.__TIDECLOAK__) {
    return window.__TIDECLOAK__;
  }

  const url = process.env.NEXT_PUBLIC_TIDECLOAK_URL;
  const realm = process.env.NEXT_PUBLIC_TIDECLOAK_REALM;
  const clientId = process.env.NEXT_PUBLIC_TIDECLOAK_CLIENT_ID;

  if (!url || !realm || !clientId) return null;
  return {
    url,
    realm,
    clientId,
    redirectUri:
      process.env.NEXT_PUBLIC_TIDECLOAK_REDIRECT_URI ??
      (typeof window !== "undefined"
        ? `${window.location.origin}/auth/redirect`
        : undefined),
  };
}

/**
 * The server exposes the active realm. When a live TideCloak realm is
 * configured the official SDK is initialised here; otherwise the built-in
 * server realm (real ES256 tokens, server-verified) is used so judges can run
 * the demo with zero infrastructure.
 */
export async function connectTideCloak(): Promise<RealmInfo> {
  const response = await fetch("/api/realm", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to reach the TrustVault realm.");
  const info = (await response.json()) as RealmInfo;

  if (info.loginMode === "live") {
    const config = readTideCloakConfig();
    if (config) {
      try {
        const { IAMService } = await import("@tidecloak/js");
        await IAMService.initIAM(config);
      } catch (error) {
        console.warn(
          "[TideCloak] Live SDK init failed; the server realm remains authoritative.",
          error,
        );
      }
    }
  }

  return info;
}

/**
 * Starts the real TideCloak OIDC redirect when a live realm is configured.
 * The server-side JWKS verifier is the source of truth for every API call.
 */
export async function beginLiveTideCloakLogin(): Promise<boolean> {
  const config = readTideCloakConfig();
  if (!config) return false;

  try {
    const { IAMService } = await import("@tidecloak/js");
    await IAMService.initIAM(config);
    const service = IAMService as unknown as {
      login?: (options?: { redirectUri?: string }) => Promise<void>;
      doLogin?: (options?: { redirectUri?: string }) => Promise<void>;
    };
    if (typeof service.login === "function") {
      await service.login({ redirectUri: config.redirectUri });
      return true;
    }
    if (typeof service.doLogin === "function") {
      await service.doLogin({ redirectUri: config.redirectUri });
      return true;
    }
  } catch (error) {
    console.warn("[TideCloak] Live login unavailable.", error);
  }
  return false;
}
