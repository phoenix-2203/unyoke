/**
 * A fixed example scan used to show visitors what Unyoke's results look like
 * (the "product shot"). Addresses are the fest test tokens and an unowned
 * placeholder; nothing here belongs to a real person.
 */
import { toQorAddress } from "@qorechain/evm";
import type { Hex } from "viem";
import type { ScanResult } from "../lib/scanAccount";

const OWNER = "0xF1C9948Be3910B70224bD4578A154f74c2aB8082" as const;
const FUSD = "0x97143b771d34ddb9130b807b135ae675a5a963ca" as Hex;
const FETH = "0x02292293c13880a26242690eb70a0e42b8e91c28" as Hex;
const FBTC = "0x4604e7e45b2ecdbfbdc157103f5b2b62cb16451a" as Hex;
const NOBODY = "0x000000000000000000000000000000000000dead" as Hex;
const HEAD = 10_251_000n;
const GRANTEE = toQorAddress(NOBODY);

export const SAMPLE_SCAN: ScanResult = {
  account: { evm: OWNER, qor: "qor178yefzlrjy9hqgjt63tc5920wnp2hqyzlfcmzu" },
  scannedFrom: 8_790_799n,
  scannedTo: HEAD,
  historyLimited: true,
  accountKind: "ethereum",
  history: { evm: [], native: [] },
  evm: [
    {
      kind: "erc20",
      token: FUSD,
      owner: OWNER.toLowerCase() as Hex,
      spender: FBTC,
      amount: (1n << 256n) - 1n,
      balance: 1_250_000_000n,
      tokenInfo: { name: "FestUSD", symbol: "fUSD", decimals: 6 },
      spenderIsContract: true,
      setAtBlock: HEAD - 40_000n,
      setInTx: null,
    },
    {
      kind: "erc20",
      token: FETH,
      owner: OWNER.toLowerCase() as Hex,
      spender: NOBODY,
      amount: 250n * 10n ** 18n,
      balance: 500n * 10n ** 18n,
      tokenInfo: { name: "FestETH", symbol: "fETH", decimals: 18 },
      spenderIsContract: false,
      setAtBlock: HEAD - 600_000n,
      setInTx: null,
    },
    {
      kind: "erc20",
      token: FBTC,
      owner: OWNER.toLowerCase() as Hex,
      spender: FUSD,
      amount: 50_000_000n,
      balance: 200_000_000n,
      tokenInfo: { name: "FestBTC", symbol: "fBTC", decimals: 8 },
      spenderIsContract: true,
      setAtBlock: HEAD - 2_000n,
      setInTx: null,
    },
  ],
  native: [
    {
      kind: "authz",
      granter: "qor178yefzlrjy9hqgjt63tc5920wnp2hqyzlfcmzu",
      grantee: GRANTEE,
      authorizationType: "/cosmos.bank.v1beta1.SendAuthorization",
      msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend",
      spendLimit: [{ denom: "uqor", amount: "5000000" }],
      expiration: null,
    },
    {
      kind: "feegrant",
      granter: "qor178yefzlrjy9hqgjt63tc5920wnp2hqyzlfcmzu",
      grantee: GRANTEE,
      allowanceType: "/cosmos.feegrant.v1beta1.BasicAllowance",
      expiration: null,
    },
  ],
};
