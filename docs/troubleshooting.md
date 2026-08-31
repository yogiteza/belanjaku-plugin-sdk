# Troubleshooting

The host is silent about most plugin failures — no console error, no
network error, the section just stays empty. Work through this list in
order; it follows the actual sequence swift-page runs.

## My plugin doesn't appear at all

1. **Is the section correctly configured?** The instance must be assigned to
   one of the five sections your `manifest.json` declared in
   `rules_schema.placements_available`, for a `scope_type` your manifest
   allows for that section. See
   [plugin-contract.md](plugin-contract.md#the-five-section-slots).

2. **Does `scope_key` resolve to something non-empty?** swift-page derives
   `scope_key` from the page (SKU for `product` scope, `vendor_code` for
   `store` scope). If that value is empty on the current page, the entire
   mount effect bails out silently before your script is even requested.
   This is easy to hit with `productDetailRightTitle`, which is
   `store`-scoped — if the product has no resolvable seller `vendor_code`,
   nothing mounts.

3. **Did the script actually load?** Check the Network tab for a request to
   your `entry_url`. A 404, a CORS failure, or a parse error (most commonly:
   your bundle is ESM, not IIFE — see
   [plugin-contract.md](plugin-contract.md#the-bundle-must-be-an-iife)) is
   swallowed by the host and produces no visible error on the page.

4. **Is `window.SwiftpageComponents[runtime_key]` actually set?** Open
   devtools after the script loads and check:

   ```js
   window.SwiftpageComponents
   // { ReviewWidget: [Function: mount], ... }
   ```

   If your key is missing: `createPlugin()` never ran (check the script
   actually executed — see #3), or it ran with a different `runtimeKey`
   string than what's in `manifest.json`. These two must match exactly, and
   the SDK validates the format but can't validate they're consistent with
   each other — that's on you.

5. **Does `runtime_key` match between `manifest.json`, `createPlugin()`, and
   the installed instance?** All three must agree.

## I see an error, but not a `[PluginSDK]`-prefixed one

Errors without the prefix aren't from this SDK — check:
- A raw `TypeError` or DOM exception is almost certainly from your own
  `setup()` code.
- `Cannot read properties of undefined (reading 'digest')` — `encryptVariables`
  is being called outside a secure context (plain HTTP staging, some
  in-app webviews) where `window.crypto.subtle` doesn't exist. Current SDK
  versions throw a `[PluginSDK]`-prefixed error for this instead — if you're
  seeing the raw error, you may be on an older SDK build.

## Actual error messages this SDK throws

| Message (prefix omitted) | Cause |
| --- | --- |
| `createPlugin requires a non-empty string runtimeKey` | `createPlugin(undefined, ...)` or similar |
| `runtimeKey "..." is not a valid JavaScript identifier...` | `runtimeKey` has spaces, dashes, or starts with a digit |
| `createPlugin requires definition.setup to be a function` | Second argument to `createPlugin` is missing `setup`, or `setup` isn't a function |
| `props.runtime_key is missing` / `props.scope_type is missing` / `props.scope_key is missing` / `props.seller_key is missing` / `props.tenant_domain is missing` | `getPluginContext(props)` called with an incomplete props object — usually means you're testing `setup()` outside the real host, or the host itself failed to populate one of these |
| `variables are required — use pluginFetchPublic for queries without variables` | Called `pluginFetch({ query }, ...)` with no `variables` key |
| `submitPluginData rejects scope_type="all_product_pages"...` | Passed `'all_product_pages'` as `scope_type` to `submitPluginData` — use `'product'`, `'store'`, or `'global'` instead; see [data-and-graphql.md](data-and-graphql.md#submitplugindata--writing-data) |
| `HTTP 403: X-Runtime-Key header is required` (or similar) | The proxy rejected the request — see [data-and-graphql.md](data-and-graphql.md#the-proxy) for the full header checklist |
| `HTTP 500: PLUGIN_GRAPHQL_URL not configured` | swift-page's environment isn't configured — an ops issue, not a plugin bug |
| `Request to ... timed out after 15000ms` | The proxy or upstream GraphQL API didn't respond |
| `tenantDomain is required for encryption` / `runtimeKey is required for encryption` | Called `encryptVariables` (directly or via `pluginFetch`) with an empty `tenantDomain`/`runtimeKey` |
| `window.crypto.subtle is unavailable...` | Non-secure context or non-browser environment — see above |

Errors logged to `console.error`/`console.warn` (not thrown — they don't
interrupt the page) are all prefixed `[PluginSDK:<runtimeKey>]`:

- `mount called without a container` — the host called your mount function
  with no element; your widget won't render, but the page doesn't crash.
- `setup threw an error: ...` — your `setup()` threw synchronously or its
  returned Promise rejected. The plugin fails to mount but nothing else
  breaks.
- `destroy threw an error: ...` — your cleanup function threw when the host
  unmounted or re-mounted the plugin.
- `a plugin is already registered under this runtime_key...` — two bundles
  loaded with the same `runtime_key`, or your bundle loaded twice. The
  second registration wins.

## Data isn't showing up / submissions fail

See [data-and-graphql.md](data-and-graphql.md) for the full submit/read
contract, and check that your `data_schema` in `manifest.json` actually
matches the shape of `payload` you're sending — server-side validation
against it happens on submit, not on read.
