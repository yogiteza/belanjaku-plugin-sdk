# Data & GraphQL

Plugins don't talk to plugin-service's GraphQL API directly. They go through
a same-origin Next.js API route in swift-page, which forwards the request
upstream. This exists so plugins never need CORS access to the backend or a
secret credential of their own.

## The proxy

Two same-origin endpoints exist in swift-page:

- `/api/plugin/graphql` → `PLUGIN_GRAPHQL_URL`
- `/api/plugin/graphql-scv` → `SCV_GRAPHQL_URL` (forwards `Authorization`;
  not documented further here — most plugins only need the first one)

`pluginFetch`/`pluginFetchPublic` default `apiUrl` to
`/api/plugin/graphql`. The proxy enforces, in order:

1. Method must be `POST`.
2. `PLUGIN_GRAPHQL_URL` must be configured server-side.
3. `PLUGIN_TENANT_DOMAIN` must be configured server-side.
4. The `X-Tenant-Domain` header must exactly equal the configured tenant
   domain — 403 otherwise.
5. If the request body also has `tenant_domain`, it must match too — 403
   otherwise.
6. `X-Runtime-Key` header is required — 403 otherwise.

Both `pluginFetch` and `pluginFetchPublic` set all the required headers for
you. If you ever bypass the SDK, missing `X-Runtime-Key` is the most common
way to get an unconditional 403 — this is exactly what happened in an
earlier version of `pluginFetchPublic`, which omitted it.

## Encrypted vs. plain variables

`pluginFetch` sends `variables` as a single AES-GCM–encrypted Base64 string.
`pluginFetchPublic` sends `variables` as a plain JSON object. The proxy
accepts either shape — decide per-request based on whether the variables
contain anything you don't want visible in browser devtools network
inspection, keeping in mind this is integrity protection, not real secrecy
(see [security.md](security.md)).

## `submitPluginData` — writing data

```ts
await submitPluginData(
  {
    runtime_key: 'ReviewWidget',
    scope_type: 'product', // 'product' | 'store' | 'global' — never 'all_product_pages'
    scope_key: sku,
    seller_key: vendorCode, // optional — see below
    payload: { rating: 5, name: 'Budi', comment: 'Great product!' },
  },
  { tenantDomain, runtimeKey, apiUrl }
);
```

`scope_type` may be `'product'`, `'store'`, or `'global'` — matching
`PluginDataService::validateScopeType()` server-side. It must **not** be
`'all_product_pages'`: even if your plugin is *installed* with
`all_product_pages` scope (rendering on every product page), the data it
submits must still be pinned to a concrete scope — usually the product's SKU,
but a plugin that aggregates data per-seller or per-tenant instead can submit
under `'store'` or `'global'`. Passing `'all_product_pages'` throws before any
network request is made:

```
[PluginSDK] submitPluginData rejects scope_type="all_product_pages" —
runtime data must be submitted per product, store, or global scope, ...
```

`seller_key` is optional — the server field is nullable. Pass it when
relevant to your scope (e.g. a `store`-scoped submission almost always wants
it); a `global`-scoped one may not have a meaningful seller to attach.

`payload` is validated against your manifest's `data_schema` server-side —
the SDK does not validate it client-side, so a submission that violates your
own schema will fail at the server, not at the call site.

## `getPublicPluginData` — reading data

```ts
const reviews = await getPublicPluginData(
  { runtime_key: 'ReviewWidget', scope_type: 'product', scope_key: sku },
  { tenantDomain, runtimeKey, apiUrl }
);
```

`scope_type` must match whatever scope the data was originally submitted
under — `'product'`, `'store'`, or `'global'`. There is no way to read
`all_product_pages`-scoped data because there's no such thing: submissions
are never stored under that scope (see above). Returns `[]` (never throws)
if there's simply no data yet; it only throws on an actual transport or
GraphQL error.

Each item is a `PluginData`:

```ts
interface PluginData {
  id: string;
  runtime_key: string;
  scope_type: string;
  scope_key: string;
  seller_key?: string; // nullable server-side — may be absent depending on scope
  payload: Record<string, unknown>;
  created_at?: string;
}
```

`payload` is exactly what you sent — untyped, and untrusted the moment it
comes back (someone else's submission, not necessarily your own code's
output). See [security.md](security.md#rendering-plugin-data-safely) before
rendering it.

## Writing a custom query

For anything beyond submit/read, build your own `GraphQLRequest` and call
`pluginFetch`/`pluginFetchPublic` directly:

```ts
const result = await pluginFetch<{ myQuery: MyType }>(
  { query: MY_QUERY, variables: { scope_key: sku } },
  { tenantDomain, runtimeKey, apiUrl }
);

if (result.errors?.length) {
  // handle result.errors
}
```
