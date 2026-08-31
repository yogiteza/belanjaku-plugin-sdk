# The plugin contract

This is how swift-page actually loads and runs your plugin. The SDK wraps
this contract, but understanding it directly is what lets you debug a plugin
that silently doesn't appear — which is the normal failure mode (see
[Troubleshooting](troubleshooting.md)).

## The bundle must be an IIFE

swift-page injects your plugin as a classic `<script async>` tag, not an ES
module:

```js
const script = document.createElement('script');
script.src = instance.entry_url;
script.async = true;
document.body.appendChild(script);
```

There is no `type="module"`. Your build output must be a self-executing
script (IIFE/UMD) — `export`/`import` at the top level will throw a syntax
error at parse time, and the script tag fails silently from the host's point
of view (see the [`build.mjs`](../examples/ReviewWidget/build.mjs) in the
reference example, which builds with esbuild's `format: 'iife'`).

## Registration: one global object

Your bundle's only job, as a side effect of loading, is to add itself to a
global registry:

```js
window.SwiftpageComponents[runtime_key] = function mount(props, element) {
  // ... build your widget into `element` ...
  return { destroy() { /* cleanup */ } }; // optional
};
```

`createPlugin()` does exactly this. The registry key is `SwiftpageComponents`
— not `Belanjaku` or `BelanjakuComponents`. This matters because the *product*
is named Belanjaku but the *runtime global* is named after swift-page (the
app's internal/legacy name); if you ever bypass the SDK and hand-roll this,
get the name wrong and nothing mounts, with no error anywhere.

## Mounting: what the host calls, and what it honors

swift-page reads `window.SwiftpageComponents[instance.runtime_key]`. If it's
not a function, the host returns silently — no error, no log:

```js
const mountFn = registry[instance.runtime_key];
if (typeof mountFn !== 'function') {
  return; // <- silent
}
const result = mountFn(mergedProps, slot);
if (result && typeof result.destroy === 'function') {
  // ... chained into cleanup on unmount/re-mount ...
}
```

Two things follow from this:

- **`mountFn` is called as a plain function**, not constructed, not awaited.
  A returned Promise is ignored. Async work must happen *inside* `setup()` —
  `createPlugin()` awaits it for you (see `README.md`'s quickstart) but the
  host itself never awaits your mount function.
- **Only `.destroy` is honored** on the return value. `update`, `render`,
  anything else you might return is inert as far as the host is concerned.

## The props you actually receive

The host builds `mergedProps` and passes it as the first argument:

```js
const mergedProps = {
  ...instanceProps,          // parsed from your manifest's props_schema, as configured per-instance
  runtime_key: instance.runtime_key,
  scope_type: scopeType,     // 'product' | 'store'
  scope_key: scopeKey,
  seller_key: sellerKey,     // pageData.vendor_code
  tenant_domain: instanceProps.tenant_domain || tenantDomain,
  theme: menuAttribute,      // the storefront's theme object, or undefined
};
```

`createPlugin()` normalizes this before calling your `setup()` — filling in
`api_url`, `tenant_domain`, `slot` defaults and merging `theme` with sane
fallbacks so a partial or missing theme from the host doesn't blow away every
default color. Without the SDK you'd need to handle that merge yourself,
since the host passes `theme` through unconditionally, partial object or not.

## The five section slots

A plugin's `manifest.json` declares which of these it can be placed into
(`rules_schema.placements_available`); an admin then assigns it to a section
per seller/store. These are the only slots that exist — there is no way to
register a new one without a swift-page code change:

| Section | `scope_type` | `scope_key` | Where it renders |
| --- | --- | --- | --- |
| `productDetailBelowTitle` | `product` | SKU | Product detail page, below the title |
| `productDetailBelowDescription` | `product` | SKU | Product detail page, below the description |
| `productDetailRightTitle` | **`store`** | seller `vendor_code` | Product detail page, beside the title |
| `etalaseBeforeSort` | `store` | seller `vendor_code` | Storefront listing page, before the sort control |
| `landingPageHiddenState` | `store` | seller `vendor_code` | Landing page, in a fixed floating box |

**`productDetailRightTitle` is not product-scoped**, despite living on the
product detail page — its `scope_key` is the seller's `vendor_code`, not the
SKU. If your plugin needs the SKU there, read it from `props.product` if the
host provides it, or use `productDetailBelowTitle`/`productDetailBelowDescription`
instead.

Use the `SECTIONS` constant exported by the SDK instead of retyping these
strings in your manifest — see [Manifest reference](manifest.md).

## Silent failures

The host does not surface most plugin loading failures to the page or the
console. If your plugin doesn't appear, work through this list — see
[Troubleshooting](troubleshooting.md) for the full version:

- `entry_url` 404s or the script errors while parsing (e.g. it's ESM, not
  IIFE) — swallowed.
- `window.SwiftpageComponents[runtime_key]` was never set, or was set under
  the wrong key — swallowed, `typeof mountFn !== 'function'` just returns.
- `scope_key` resolves empty (e.g. `productDetailRightTitle` on a page with
  no `vendor_code`) — nothing mounts, the whole effect bails early.
- **Plugins never render for crawlers.** swift-page skips plugin discovery
  entirely for bot user agents. If your plugin renders content you want
  indexed, it will not be — build that content into the page itself instead.

## Data submission is proxied and encrypted

Anything your plugin sends to or reads from the backend (reviews, ratings,
any custom data) goes through a same-origin Next.js API route in swift-page,
which forwards to the plugin-service GraphQL API. See
[Data & GraphQL](data-and-graphql.md) for the wire format and
[Security notes](security.md) for what the encryption does and doesn't
guarantee.
