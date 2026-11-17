/** Where is Unyoke running, and can this wallet send an EVM transaction right now? */
import { windowAllowsTx } from "../lib/revoke";

/** Inside the QoreX mobile app's browser, which opens a window per EVM transaction by itself. */
export function isQorexMobile(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as { qorex?: unknown }).qorex && /Mobile|iPhone|iPad|Android/i.test(navigator.userAgent);
}

export const NO_WINDOW_HELP =
  "QoreChain only accepts an EVM transaction inside a post-quantum window, and this wallet can't open one. " +
  "Open this page in the QoreX app's browser on your phone: it opens a one-transaction window for you. " +
  "(Keplr and other desktop wallets show this as \"An unknown RPC error occurred\".)";

/**
 * Before a desktop wallet signs an EVM transaction, check the account's window.
 * Returns a message explaining why it would be refused, or undefined if it can go ahead.
 * QoreX mobile is never blocked: it opens its own window.
 */
export async function evmWindowBlocker(rest: string, qor: string, target: string): Promise<string | undefined> {
  if (isQorexMobile()) return undefined;
  try {
    const r = await fetch(`${rest}/qorechain/pqc/v1/evm_window/${qor}`);
    if (!r.ok) return undefined; // can't tell: let the wallet try
    return windowAllowsTx(await r.json(), target) ? undefined : NO_WINDOW_HELP;
  } catch {
    return undefined;
  }
}

/** Wallets that hide the chain's reason behind a generic error. */
export function explainEvmError(m: string): string {
  return /unknown rpc error|internal json-rpc error/i.test(m) && !isQorexMobile() ? `${m} ${NO_WINDOW_HELP}` : m;
}
