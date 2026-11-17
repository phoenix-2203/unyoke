/**
 * DEVELOPMENT ONLY: stand in for the QoreX wallet with QoreChain's official
 * test double (@qorechain/qorex-wallet-mock), so the native-lane steps can be
 * tested on desktop against the testnet. The QoreX Chrome extension has no
 * documented testnet switch today.
 *
 * Off unless VITE_QOREX_MOCK_MNEMONIC is set in .env.local (git-ignored).
 * Use a THROWAWAY testnet phrase only, never a phrase that holds real funds.
 * The production build refuses to run with this variable set (vite.config.ts),
 * and this module is only imported in dev.
 *
 * It proves our messages are well formed and accepted by the chain. It does NOT
 * prove the real QoreX wallet accepts them; confirm that with QoreX itself.
 *
 * Limit: the mock's native account is the Cosmos-style one (coin type 118), so a
 * window it opens does not cover an Ethereum-style (coin 60) EVM account. Use it
 * for native-lane grants and revokes, and to check window messages are accepted.
 */
import { createQorexMock } from "@qorechain/qorex-wallet-mock";

export function installQorexMockIfConfigured(): boolean {
  const mnemonic = import.meta.env.VITE_QOREX_MOCK_MNEMONIC?.trim();
  if (!mnemonic) return false;
  const words = mnemonic.split(/\s+/).length;
  if (words !== 12 && words !== 24) {
    console.warn("[unyoke] VITE_QOREX_MOCK_MNEMONIC must be 12 or 24 words; the test wallet was not installed.");
    return false;
  }
  createQorexMock({
    mnemonic,
    chainId: "qorechain-diana",
    // The public REST API sends no CORS headers; go through the dev server's proxy.
    rest: `${window.location.origin}/lcd-testnet`,
    allowMainnet: false,
    autoApprove: true,
  }).install(window);
  console.info("[unyoke] Test wallet (QoreX mock) installed on testnet. Not the real QoreX.");
  return true;
}
