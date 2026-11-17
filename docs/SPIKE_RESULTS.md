# Spike results: how revokes can be signed on QoreChain today

Tested on 17 November 2026 on the `qorechain-diana` testnet, from the QoreX iOS
app's dApp browser, with a throwaway Ethereum-style (coin 60) account
`qor178yefzlrjy9hqgjt63tc5920wnp2hqyzlfcmzu` (`0xF1C9948Be3910B70224bD4578A154f74c2aB8082`).

## What we learned

| Question | Answer | Evidence |
| --- | --- | --- |
| Can a website ask QoreX to open an EVM window (`MsgOpenEVMWindow`)? | **No.** QoreX refuses: *"MsgOpenEVMWindow is managed by the wallet itself, not by a website."* | Spike log |
| Can a website ask QoreX to close one (`MsgCloseEVMWindow`)? | **No.** QoreX refuses: *"QoreX cannot show what MsgCloseEVMWindow does, so it will not sign it."* | Spike log |
| Can a website send an EVM revoke through QoreX mobile? | **Yes.** QoreX mobile signs `approve(spender, 0)` from its dApp browser. | Txs below |
| What window does QoreX use for it? | QoreX opens a **new window per EVM transaction, by itself**: only the called token contract, **1 transaction**, **100 blocks**, value capped at that transaction's maximum fee. It is used up by the transaction. | `MsgOpenEVMWindow` records below |
| Can a website ask QoreX to revoke an authz grant (`MsgRevoke`)? | **Yes**, hybrid-signed ("shielded"). | Txs below |
| Can a website ask QoreX to revoke a fee grant (`MsgRevokeAllowance`)? | **Yes**, hybrid-signed ("shielded"). | Txs below |
| Does the QoreX Chrome extension work on testnet? | No documented testnet switch; the extension also does not sign EVM transactions yet. Testing used the mobile app. | QoreX docs |

## What this changes in Unyoke

- Unyoke does **not** open or close windows. On QoreX mobile the wallet scopes
  every EVM revoke more tightly than Unyoke planned to (one transaction per
  window instead of one shared window).
- After each EVM revoke, Unyoke reads the window record and shows on the receipt
  that it was limited to that token, 1 transaction, and used up.
- On desktop, where the extension cannot sign EVM transactions, Unyoke hands the
  revoke step to the phone (QR code to the same page in the QoreX dApp browser).
- Native-lane revokes (authz, fee grants) are sent straight to QoreX.
- Still to test: `MsgClearEVMDelegation` (clearing EIP-7702 consent). Given the
  close-window refusal, QoreX may not display it either.

## Receipts (testnet)

| Height | Tx hash | What |
| --- | --- | --- |
| 10248853 | `D69FAD63A465BE13D4FE830CA6FA8EDF3877E5C292DF68F7887D0A64770DCBF9` | Post-quantum key registered (`MsgRegisterPQCKeyV2`, by QoreX on first send) |
| 10250029 | `52D2728E5BC92AB82D349CBF1762A3AFF88AFA78D0E4A676829E3D44691C34CA` | Window opened by QoreX: fUSD only, 1 tx, 100 blocks, 13,143 uqor |
| 10250031 | `E1435EBBE51AC2A9C321DB9481291B65977CC2D78833A202397B20B78F2F8FCD` | Test approval: 1 fUSD to `0x…dEaD` |
| 10250034 | `4CAAA2045025DD892DB2F010C936E1C8F7661C179C55489D05B68EAEBC7A3167` | Window opened by QoreX: fUSD only, 1 tx, 100 blocks, 7,461 uqor |
| 10250036 | `2201648BBD5D526761819BC6BF1A6106275706CBBF2CC16E91F1A59BCBFED635` | Revoke: allowance set to 0 |
| 10250155 | `3212FCAC4E2E919052A96ECAEA93A6B16AF1BD57E90DA3A1378011A1B9CCBD29` | Window (second run): fUSD only, 1 tx |
| 10250157 | `7FEC4D7BE8F284EF0532C444427DD43F99E179AA49E7780B2C32D952C8EE8ADD` | Test approval (second run) |
| 10250160 | `67FDF5BF41BC3E1A8E7621050C67ADA5BF0CFED1DF454B911B0490CDDE687A31` | Window (second run): fUSD only, 1 tx |
| 10250163 | `FF1E2CAAE4E068C67E424D121E8596DF025C4A880AE7C2B71254AB8FA76D229D` | Revoke (second run) |
| 10250177 | `9703480895DE83FD554EE0B6BB36F15E5220DCFD7C26B022856FD1038E67901F` | Test authz grant (vote only, 1 day) |
| 10250181 | `F8AECB8BE490E531DA998213248E395321A879F1D9FC29095833602118EC3D72` | Authz grant revoked (`MsgRevoke`) |
| 10250192 | `086D5DFAF558EFC98B470314E450FB8869425C0B723C3578E9CCED5031896B94` | Test fee grant (1,000 uqor) |
| 10250195 | `6EFD39188E4110C79E6C65CE22AF95ED0B2D47B480D7E6ADEF36FB4AFAC503F0` | Fee grant revoked (`MsgRevokeAllowance`) |

Hashes are Cosmos transaction hashes; EVM transactions appear as `MsgEthereumTx`.
Read with `GET https://api-testnet.qore.host/cosmos/tx/v1beta1/txs/{hash}`.
