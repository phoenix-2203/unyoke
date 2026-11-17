/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  /** Development only: throwaway testnet phrase for the QoreX test double. Never set in production. */
  readonly VITE_QOREX_MOCK_MNEMONIC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
