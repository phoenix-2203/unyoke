# How AI was used to build Unyoke

Unyoke was built by one person, [phoenix-2203](https://github.com/phoenix-2203), working with **Claude** (Anthropic, Claude Opus 5.5) in the Claude desktop app's Cowork mode. This file says plainly what the AI did, what the human did, and how the work was checked.

## Tools

| Tool | Used for |
|---|---|
| Claude (Cowork mode) | Research, idea checks, writing the code, tests and docs, small commits, reading the chain while debugging |
| Claude's browser pane | Reading QoreChain docs and the fest's own site, checking the live app, reading testnet data through the app's relay |
| QoreX mobile app and browser extension (human) | Every real signature: grants, approvals, revokes, windows |
| Playwright, three.js, ffmpeg, Kokoro (an open text-to-speech model, run offline) | The demo video: recording the real app, the 3D devices, the voiceover |
| axe-core, Lighthouse | Accessibility (WCAG 2.1 AA) and speed checks after the design redo |

No AI service is called at runtime. Unyoke itself has no model, no API key and no backend.

## Who did what

| Step | Human | AI |
|---|---|---|
| Idea | Asked for something **original**, useful to a new chain, in an uncrowded track. Rejected an earlier idea that turned out not to be original. Chose "whole account, both lanes" over EVM-only. | Studied the fest's rules and every existing entry (62 repositories, read in full), the QoreChain docs, npm and the explorer, to find a gap. Found that nobody revoked native-lane permissions (authz, fee grants, 7702 consent). |
| Name | Picked **Unyoke** from a shortlist. | Checked the candidate names for clashes. |
| Spike | Ran each experiment from the QoreX app on a phone and sent back screenshots. | Wrote the spike page; worked out from the results that QoreX won't open or close windows for websites, but opens its own one-transaction window per EVM transaction. Recorded it in [docs/SPIKE_RESULTS.md](docs/SPIKE_RESULTS.md). |
| Code | Reviewed every change in the running app, on desktop and phone. | Wrote the TypeScript: the scanner, risk rules, revoke flow, receipt, revoke history, sandbox, phone hand-off, deploy files. |
| Design | Rejected two designs ("boring and simple") and asked for research into good security sites; approved the third and asked for the interactive landing page. | Studied revoke.cash, Blockaid, Rabby, Linear and Phantom, then designed and built the interface. |
| Testing | Made real permissions with the sandbox and revoked them from QoreX on testnet; reported every failure (Keplr's "unknown RPC error", the QR opening the browser, a stale cached page); found that the extension's hidden testnet switch makes desktop revokes work. | Wrote the unit tests (106 now); traced each failure to its cause (missing EVM window, a plain link instead of QoreX's universal link, HTML caching) and fixed it. |
| Design redo | Asked for the same research-and-redo as Cista, without copying it; picked the Volt direction (the lime, sharpened) from three samples. | Studied Revoke.cash, Rabby, De.Fi Shield and Blockaid (structure, type, colour, table layout); found Unyoke's gaps (a slow scan with only a progress bar, long result cards, no summary tabs, no search, no FAQ, the same fonts as Cista, fonts from Google); built the fixes: results while scanning, a compact table with filters, search and sort, tabs, the comparison and FAQ, self-hosted Geist; checked accessibility with axe-core and speed with Lighthouse. |
| Deploy | Ran the setup script on his own VPS, with his DuckDNS name. | Wrote the Caddy site and setup script, so the other sites on that server are untouched if anything fails. |
| Testnet extras | Asked for the Ship Weeks badges; ran the scripts on his Mac and added the project's test account to the fest page. | Wrote `PqcKeyCheck` (a read-only contract over the PQC key-status precompile), checked it against live testnet before deploying, and wrote the deploy, AMM swap and QoreSeal scripts. Each scan now uses the contract. |
| Review | Asked for a full sweep for bugs and a look at what the product might be missing; decided to keep linked keys out of scope. | Swept the code and every page, fixed what it found (risk gaps, unread pages of grants, history that could miss older revokes, a mobile layout bug, page weight), and researched QoreChain and other revoke tools. |
| Demo video | Wrote the production brief, picked the voice, rejected the first laptop and asked for the phone flow; supplied real QoreX screenshots from his iPhone. | Made the film: the real app replaying data captured from testnet, 3D devices drawn in three.js, sourced statistics, voiceover and subtitles. No wallet screen or transaction in it was invented. |
| Writing | Asked for a README better than his previous project's. | Wrote the README, this file, and the fest form text. |

## How the AI's work was checked

- **Tests and types on every change.** `pnpm typecheck`, `pnpm test` (106 tests) and `pnpm build` before each commit, plus CI on GitHub.
- **A repeatable end-to-end check.** `pnpm e2e:testnet` creates, scans, revokes and re-scans permissions on testnet with Unyoke's own code, and fails loudly if any step doesn't hold.
- **Real transactions, not mocks.** Every kind of revoke was done on testnet from the QoreX app. The hashes are in the [README](README.md#proven-on-testnet), and the AI read them back from the chain to confirm what each one did (for example, that each EVM window allowed only fUSD and one transaction).
- **No claim without a source.** Figures in the README link to their source (Scam Sniffer's 2025 report). Where something wasn't tested, such as clearing 7702 consent through QoreX, the README says so.
- **Small, reviewable commits**, pushed one by one, at the human's request.

## Safety rules the AI followed

- It never asked for, saw or stored a seed phrase or private key. All signing happened in QoreX, on the human's phone or in his browser extension.
- Scripts that need a key (`seed-demo`, `e2e-testnet`, `deploy-pqc-check`, `amm-swap`, `register-qoreseal-key`) only take a **throwaway testnet** phrase from a git-ignored `.env.seed`, refuse accounts holding more than 50 QOR, and were run by the human on his own computer.
- The build refuses to run if the QoreX test double's phrase is set, so it can't reach a production bundle.

## What AI did not do

- Decide what to build or when it was good enough.
- Sign anything, or hold any funds.
- Invent results: when a test failed, the failure was reported and fixed, and the README lists what is still untested.
