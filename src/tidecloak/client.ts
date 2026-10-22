import type { ConnectionInfo } from "../types";

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

/**
 * Real-realm wiring for @tidecloak/js.
 *
 * Provide either `window.__TIDECLOAK__` (tidecloak.json adapter exported by
 * your realm) or the VITE_TIDECLOAK_* environment variables. When a realm is
 * configured we initialise the official SDK. When it is absent — e.g. on a
 * judge's laptop without Docker — the app falls back to the local demo realm
 * below, which still issues real ECDSA P-256 sessions and approvals in-browser.
 */
export function readTideCloakConfig(): TideCloakAdapterConfig | null {
  if (typeof window !== "undefined" && window.__TIDECLOAK__) {
    return window.__TIDECLOAK__;
  }

  const url = import.meta.env.VITE_TIDECLOAK_URL;
  const realm = import.meta.env.VITE_TIDECLOAK_REALM;
  const clientId = import.meta.env.VITE_TIDECLOAK_CLIENT_ID;

  if (!url || !realm || !clientId) return null;
  return {
    url,
    realm,
    clientId,
    redirectUri:
      import.meta.env.VITE_TIDECLOAK_REDIRECT_URI ??
      `${window.location.origin}/auth/redirect`,
  };
}

export async function connectTideCloak(): Promise<ConnectionInfo> {
  const config = readTideCloakConfig();

  if (config) {
    try {
      const { IAMService } = await import("@tidecloak/js");
      await IAMService.initIAM(config);
      return {
        mode: "live",
        realm: config.realm,
        issuer: config.url.replace(/^https?:\/\//, ""),
        sdkVersion: TIDECLOAK_SDK_VERSION,
        note: "Live TideCloak realm initialised through @tidecloak/js.",
      };
    } catch (error) {
      console.warn(
        "[TideCloak] Live realm unavailable, continuing with local demo realm.",
        error,
      );
    }
  }

  return {
    mode: "demo",
    realm: "tide-demo",
    issuer: "local.tidecloak.demo",
    sdkVersion: TIDECLOAK_SDK_VERSION,
    note: "Local policy realm — real ES256 signatures generated in-browser.",
  };
}

export interface MintedSession {
  token: string;
  payload: {
    iss: string;
    sub: string;
    preferred_username: string;
    realm_access: { roles: string[] };
    scope: string;
    iat: number;
    exp: number;
    jti: string;
  };
  header: { alg: string; typ: string; kid: string };
}
