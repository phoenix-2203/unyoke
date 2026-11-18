/**
 * Make sure an EVM wallet is connected on the scanned account before an EVM
 * transaction, connecting it if needed, so nobody has to find the Connect
 * button first. Native-lane actions don't need this: they go to QoreX directly.
 */
import { useCallback } from "react";
import { useAccount, useConnect } from "wagmi";
import { shortAddress } from "../lib/format";

export function useEnsureEvmAccount() {
  const { address } = useAccount();
  const { connectors, connectAsync } = useConnect();

  return useCallback(
    async (expected: string): Promise<string> => {
      let current = address;
      if (!current) {
        // QoreX first, then any other injected wallet; skip ones that aren't there.
        const ordered = [...connectors].sort((a, b) => Number(/qorex/i.test(b.id)) - Number(/qorex/i.test(a.id)));
        let lastError: unknown;
        for (const c of ordered) {
          try {
            const res = await connectAsync({ connector: c });
            current = res.accounts[0];
            if (current) break;
          } catch (e) {
            lastError = e;
          }
        }
        if (!current) {
          throw new Error(
            `Couldn't connect an EVM wallet${lastError instanceof Error ? ` (${lastError.message})` : ""}. Tap Connect Wallet at the top, then try again.`,
          );
        }
      }
      if (current.toLowerCase() !== expected.toLowerCase()) {
        throw new Error(
          `Your wallet is on ${shortAddress(current)}, but you scanned ${shortAddress(expected)}. Switch to that account in your wallet (QoreX: tap the account at the top), then try again.`,
        );
      }
      return current;
    },
    [address, connectors, connectAsync],
  );
}
