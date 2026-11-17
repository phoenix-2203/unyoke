import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// The public REST APIs send no CORS headers, so the browser reaches them
// through the dev (and preview) server: /lcd-testnet and /lcd-mainnet are
// forwarded to each network's REST endpoint (see REST_PROXY in src/App.tsx).
// In production, serve the app behind a proxy that does the same.
const rest = (target: string) => ({
  target,
  changeOrigin: true,
  rewrite: (p: string) => p.replace(/^\/lcd-(testnet|mainnet)/, ""),
});
const proxy = {
  "/lcd-testnet": rest("https://api-testnet.qore.host"),
  "/lcd-mainnet": rest("https://api.qore.host"),
};

export default defineConfig(({ command, mode }) => {
  // The QoreX test double's phrase must never reach a production bundle.
  if (command === "build" && loadEnv(mode, ".", "VITE_").VITE_QOREX_MOCK_MNEMONIC) {
    throw new Error("Refusing to build: VITE_QOREX_MOCK_MNEMONIC is set. Remove it from .env files first.");
  }
  return {
    plugins: [react()],
    server: { port: 5173, proxy },
    preview: { proxy },
    build: { target: "es2022" },
  };
});
