import "@rainbow-me/rainbowkit/styles.css";
import "./styles.css";

import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";

import { App } from "./App.js";
import { useTheme } from "./ui/theme.js";
import { config } from "./wagmi.js";

const queryClient = new QueryClient();

// Development only: optional stand-in for QoreX on testnet (see src/dev/installQorexMock.ts).
if (import.meta.env.DEV) {
  const { installQorexMockIfConfigured } = await import("./dev/installQorexMock.js");
  installQorexMockIfConfigured();
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

const walletTheme = { accentColor: "#d8ff5c", accentColorForeground: "#0b0d02", borderRadius: "large", fontStack: "system" } as const;

function Root() {
  const [theme, toggleTheme] = useTheme();
  return (
    <RainbowKitProvider theme={theme === "light" ? lightTheme(walletTheme) : darkTheme(walletTheme)}>
      <App theme={theme} onToggleTheme={toggleTheme} />
    </RainbowKitProvider>
  );
}

createRoot(container).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <Root />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
