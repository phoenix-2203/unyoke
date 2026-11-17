/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  /** Development only: throwaway testnet phrase for the QoreX test double. Never set in production. */
  readonly VITE_QOREX_MOCK_MNEMONIC?: string;
  /** Address the "Try a sample account" button scans. */
  readonly VITE_DEMO_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
