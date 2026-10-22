/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TIDECLOAK_URL?: string;
  readonly VITE_TIDECLOAK_REALM?: string;
  readonly VITE_TIDECLOAK_CLIENT_ID?: string;
  readonly VITE_TIDECLOAK_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
