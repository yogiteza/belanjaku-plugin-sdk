# Contributing

## Setup

```bash
git clone <this repo>
cd belanjaku-plugin-sdk
npm install
```

## Scripts

| Command                                   | Does                                          |
| ----------------------------------------- | --------------------------------------------- |
| `npm run typecheck`                       | `tsc --noEmit` over `src/`, including tests   |
| `npm run lint`                            | ESLint over `src/`                            |
| `npm run format` / `npm run format:check` | Prettier write / check                        |
| `npm test` / `npm run test:watch`         | Vitest                                        |
| `npm run build`                           | Rollup build to `dist/` (ESM + CJS + `.d.ts`) |

`npm run prepublishOnly` runs typecheck, lint, test, and build in sequence —
this is also the minimum bar a change should clear before opening a PR.

## Making a change

- If you touch anything under `src/plugin/`, `src/graphql/`, or
  `src/crypto/`, re-check it against the actual host contract in
  `../swift-page/core/modules/plugin/` and, if relevant, the server schema
  in `../belanjaku-plugin-service/graphql/`. This SDK has shipped with drift
  from both before (see `CHANGELOG.md`) — the tests in `src/__tests__/`
  exist specifically to catch that class of bug; add to them rather than
  removing coverage.
- Keep `docs/manifest.md` in sync with
  `belanjaku-plugin-service`'s `PluginUploadService::validateManifest()` if
  that validation ever changes — this repo does not import that code, so
  nothing will warn you if they drift.
- Update `examples/ReviewWidget/` if you change a public API it uses; it's
  meant to stay a working, buildable reference, not just sample code.
- Run `npm run build` and confirm `dist/index.esm.js` still contains the
  string `SwiftpageComponents` — that's the whole point of the bundle.

## Reporting a security issue

Please report security issues privately to the maintainers rather than
opening a public issue.
