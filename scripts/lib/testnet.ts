/**
 * Shared helpers for the testnet scripts (seed-demo, e2e-testnet).
 *
 * They sign with a THROWAWAY testnet phrase from the git-ignored .env.seed and
 * refuse anything that looks like a real wallet: mainnet, more than 50 QOR, a
 * missing post-quantum key, or (for scripts that clean up) the demo account.
 */
import { qorechainTestnet } from "@qorechain/evm";
import { appendFileSync, chmodSync, existsSync } from "node:fs";
import { EthNativeSigner, buildRegisterPqcKeyMsg, deriveUnifiedAccount, generateMnemonic, openEvmWindowMsg, signProofOfPossession } from "@qorechain/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const CHAIN_ID = "qorechain-diana";
export const REST = "https://api-testnet.qore.host";
export const FUSD = "0x97143B771D34ddb9130b807b135Ae675A5a963CA" as const;
/** Unyoke's sample account: its permissions are left open on purpose. */
export const DEMO_ACCOUNT = "qor178yefzlrjy9hqgjt63tc5920wnp2hqyzlfcmzu";
export const NATIVE_FEE = { amount: [{ denom: "uqor", amount: "90000" }], gas: "600000" };
export const MAX_FEE_PER_GAS = 250_000_000_000n;

export async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${REST}${path}`, init);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

export interface Included {
  code: number;
  transactionHash: string;
  height?: number;
  rawLog?: string;
}

/** Broadcast a signed native tx over REST and wait for inclusion. */
export const transport = {
  async broadcastTx(tx: Uint8Array): Promise<Included> {
    const res = await rest<{ tx_response: { code: number; txhash: string; raw_log: string } }>("/cosmos/tx/v1beta1/txs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tx_bytes: Buffer.from(tx).toString("base64"), mode: "BROADCAST_MODE_SYNC" }),
    });
    const { code, txhash, raw_log } = res.tx_response;
    if (code !== 0) return { code, transactionHash: txhash, rawLog: raw_log };
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const got = await fetch(`${REST}/cosmos/tx/v1beta1/txs/${txhash}`);
      if (got.ok) {
        const j = (await got.json()) as { tx_response: { code: number; height: string; raw_log: string } };
        return { code: j.tx_response.code, transactionHash: txhash, height: Number(j.tx_response.height), rawLog: j.tx_response.raw_log };
      }
    }
    throw new Error(`Not included after 45 s: ${txhash}`);
  },
};

export interface TestAccount {
  qor: string;
  evm: `0x${string}`;
  /** Send hybrid-signed native messages; returns the tx hash. */
  native(label: string, messages: { typeUrl: string; value: unknown }[], memo?: string): Promise<string>;
  /** Open a window that admits only these contracts, for this many transactions. */
  openWindow(targets: string[], maxTxs: number, gasPerTx?: bigint): Promise<string>;
  wallet: ReturnType<typeof createWalletClient>;
  pub: ReturnType<typeof createPublicClient>;
}

/**
 * Load the throwaway account from .env.seed and check it is safe to use.
 *
 * With `create`, a first run with no phrase makes a brand-new one, saves it to
 * .env.seed (file mode 600, git-ignored) and stops so you can fund it: your own
 * wallet's phrase is never needed. Its post-quantum key is registered on first use.
 */
export async function loadTestAccount(opts: { refuseDemo?: boolean; create?: boolean } = {}): Promise<TestAccount> {
  let mnemonic = (process.env.E2E_MNEMONIC ?? process.env.SEED_MNEMONIC)?.trim();
  if (!mnemonic && opts.create) {
    mnemonic = generateMnemonic(256);
    appendFileSync(".env.seed", `${existsSync(".env.seed") ? "\n" : ""}# Throwaway TESTNET account made by pnpm e2e:testnet. Never fund it with real value.\nE2E_MNEMONIC="${mnemonic}"\n`);
    chmodSync(".env.seed", 0o600);
    const fresh = await deriveUnifiedAccount(mnemonic);
    throw new Error(
      `Made a new throwaway testnet account and saved its phrase in .env.seed (git-ignored):\n\n    ${fresh.cosmos}\n\n` +
        "Send it 1 test QOR from QoreX (or the faucet), then run the command again.",
    );
  }
  if (!mnemonic) throw new Error("Set E2E_MNEMONIC (or SEED_MNEMONIC) in .env.seed: a THROWAWAY testnet phrase.");
  const acc = await deriveUnifiedAccount(mnemonic);

  if (opts.refuseDemo && acc.cosmos === DEMO_ACCOUNT) {
    throw new Error("That's Unyoke's sample account, whose permissions stay open on purpose. Use a different throwaway account.");
  }
  const bal = await rest<{ balance: { amount: string } }>(`/cosmos/bank/v1beta1/balances/${acc.cosmos}/by_denom?denom=uqor`);
  const uqor = BigInt(bal.balance?.amount ?? "0");
  if (uqor > 50_000_000n) throw new Error("This account holds more than 50 QOR. Use a throwaway testnet account.");
  if (uqor < 500_000n) throw new Error(`Fund ${acc.cosmos} with at least 0.5 test QOR first (https://dashboard.qorechain.io/faucet).`);
  const signer = new EthNativeSigner(acc, { signMode: "hybrid", rest: REST });
  const pqc = await rest<{ found: boolean }>(`/qorechain/pqc/v1/account/${acc.cosmos}`);
  if (!pqc.found) {
    if (!opts.create) {
      throw new Error("No post-quantum key registered. Import the phrase in QoreX as an Ethereum account and send 0.01 QOR to yourself once.");
    }
    // Registration is the one message the chain accepts with only the classical signature.
    const a = await rest<{ account: { account_number: string; sequence: string } }>(`/cosmos/auth/v1beta1/accounts/${acc.cosmos}`);
    const proofOfPossession = signProofOfPossession({ chainId: CHAIN_ID, account: acc.cosmos, keypair: acc.pqc });
    const res = (await new EthNativeSigner(acc, { signMode: "classical", rest: REST }).signAndBroadcast(transport, {
      chainId: CHAIN_ID,
      accountNumber: BigInt(a.account.account_number),
      sequence: BigInt(a.account.sequence),
      fee: NATIVE_FEE,
      messages: [buildRegisterPqcKeyMsg(acc.cosmos, { pqcKeypair: acc.pqc, proofOfPossession })] as never,
      memo: "unyoke script: register post-quantum key",
    })) as Included;
    if (res.code !== 0) throw new Error(`Registering the post-quantum key failed (code ${res.code}): ${res.rawLog}`);
    console.log(`Registered the account's ML-DSA-87 key: ${res.transactionHash}`);
  }

  async function native(label: string, messages: { typeUrl: string; value: unknown }[], memo = `unyoke script: ${label}`) {
    const a = await rest<{ account: { account_number: string; sequence: string } }>(`/cosmos/auth/v1beta1/accounts/${acc.cosmos}`);
    const res = (await signer.signAndBroadcast(transport, {
      chainId: CHAIN_ID,
      accountNumber: BigInt(a.account.account_number),
      sequence: BigInt(a.account.sequence),
      fee: NATIVE_FEE,
      messages: messages as never,
      memo,
    })) as Included;
    if (res.code !== 0) throw new Error(`${label} failed (code ${res.code}): ${res.rawLog}`);
    return res.transactionHash;
  }
  async function openWindow(targets: string[], maxTxs: number, gasPerTx = 100_000n) {
    const { evmWindowCost } = await import("@qorechain/evm");
    const maxValue = evmWindowCost({ gas: gasPerTx, maxFeePerGas: MAX_FEE_PER_GAS }) * BigInt(maxTxs);
    return native("open window", [openEvmWindowMsg({ sender: acc.cosmos, blocks: 100, maxTxs, maxValue: maxValue.toString(), allowedTargets: targets })]);
  }

  const wallet = createWalletClient({ account: privateKeyToAccount(acc.privateKey as `0x${string}`), chain: qorechainTestnet, transport: http() });
  const pub = createPublicClient({ chain: qorechainTestnet, transport: http() });
  return { qor: acc.cosmos, evm: acc.evm as `0x${string}`, native, openWindow, wallet, pub };
}
