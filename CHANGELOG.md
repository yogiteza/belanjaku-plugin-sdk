# Changelog

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/).

## Unreleased

### Fixed

- `submitPluginData()` rejected any `scope_type` other than `'product'`, and
  `getPublicPluginData()` hardcoded `scope_type: 'product'` with no way to
  override it. Cross-checked against the actual server validation
  (`PluginDataService::validateScopeType()` in belanjaku-plugin-service) —
  the server accepts `'product'`, `'store'`, **and** `'global'` for submitted
  data, and only rejects `'all_product_pages'` (since data must be pinned to
  a concrete scope even when the plugin instance itself is installed
  platform-wide). The SDK was silently blocking legitimate store- and
  global-scoped data submissions/reads that the server always supported.
  `submitPluginData`'s `scope_type` guard and `getPublicPluginData`'s
  signature (now takes a required `scope_type` parameter) were both fixed to
  match; see the new `PluginDataScopeType` type. Also: `seller_key` on
  `SubmitPluginDataInput` is now optional, matching the nullable server
  field — it was incorrectly typed as required.
- `submitPluginData()` and `getPublicPluginData()` selected a `status` field
  on `PluginData` that no longer exists in the plugin-service schema (it was
  dropped in a migration) — both calls always failed GraphQL validation.
  Removed the field from both built-in queries and the `PluginData` type.
- An `async setup()` never ran its cleanup function: `createPlugin()` only
  called `destroy` when `setup()`'s return value was synchronously a
  function, so an async `setup` (a documented, supported pattern) returned a
  `Promise` instead and cleanup was silently skipped on every unmount and
  re-mount. `createPlugin()` now awaits `setup()` regardless of whether it's
  sync or async before wiring up `destroy()`.
- `pluginFetchPublic()` omitted the `X-Runtime-Key` header the proxy
  requires, so every call returned `403 Forbidden` unconditionally. Its
  options type also made this impossible for a caller to work around.
- The default theme in `createPlugin()` was destroyed rather than merged
  whenever the host passed a partial or `undefined` `theme` — `{...props}`
  spread over the defaults, wiping them instead of filling gaps. Theme
  merging is now explicit: `{ ...DEFAULT_THEME, ...props.theme }`.
- `encryptVariables()` threw an unhelpful native error
  (`Cannot read properties of undefined`) instead of an actionable one when
  `window.crypto.subtle` was unavailable (non-secure context, non-browser
  environment). It also constructed a module-scope `TextEncoder`, which
  meant merely importing the crypto module could throw during SSR — this is
  now lazy.

### Added

- `src/manifest/` — `PluginManifest`/`PluginRulesSchema` types,
  `defineManifest()`, and a `SECTIONS` constant, modeling
  `manifest.json`'s actual validated shape and the five real section slots.
  Previously undocumented and untyped anywhere in this repo.
- `src/utils/` — `escapeHtml()` for safely rendering plugin-submitted data,
  and `SDK_VERSION`.
- `getPluginContext()` as the non-deprecated name for `usePluginContext()`
  (kept as an alias) — the old name reads as a React hook, but this SDK has
  no React dependency.
- Typed `window.SwiftpageComponents` global instead of `as any` casts.
- A warning when a `runtime_key` is registered twice, instead of silently
  overwriting the previous registration.
- Validation of `runtimeKey`'s format and `definition.setup`'s presence at
  `createPlugin()` call time, rather than failing later and deeper inside
  the host at mount time.
- Full documentation set under `docs/` (plugin contract, getting started,
  manifest reference, API reference, data/GraphQL, security, troubleshooting)
  and a rebuilt English `README.md`.
- Vitest test suite covering the crypto round-trip against the host's exact
  decryption algorithm, the mount/destroy contract (including the async
  `setup` regression above), and the GraphQL header/query-shape contract.
- ESLint + Prettier configuration.
- `LICENSE`, `.gitignore`, `CONTRIBUTING.md`, this changelog.
- Packaging: `exports` map, `sideEffects: false`, `publishConfig.access:
"public"`, `engines`, `repository`/`homepage`/`bugs`.

### Changed

- `examples/ReviewWidget/` is now a complete, buildable reference package
  (`package.json`, `manifest.json`, an esbuild `build.mjs`, escaped HTML
  output) rather than a single non-runnable source file, and no longer
  averages ratings incorrectly on string payload values.

## 1.0.0

Initial version.
