# API reference

## Plugin lifecycle

### `createPlugin(runtimeKey, definition)`

Registers a plugin on `window.SwiftpageComponents[runtimeKey]` and wires up
the mount/destroy lifecycle. See
[plugin-contract.md](plugin-contract.md#registration-one-global-object) for
what registration means to the host.

```ts
function createPlugin<TProps extends PluginBaseProps = PluginBaseProps>(
  runtimeKey: string,
  definition: PluginDefinition<TProps>
): MountFn<TProps>;

interface PluginDefinition<TProps> {
  setup(props: TProps, container: HTMLElement): SetupResult | Promise<SetupResult>;
}
type SetupResult = (() => void) | void;
```

Throws synchronously if:
- `runtimeKey` is empty or not a valid JS identifier,
- `definition.setup` is not a function.

What it does for you at mount time:
- fills in default `api_url`, `tenant_domain`, `slot`, and merges `theme`
  with sensible defaults rather than letting a partial/missing theme from
  the host wipe them out;
- warns (via `console.warn`) instead of silently no-oping if `container` is
  missing;
- awaits `setup()` whether it's sync or async before wiring `destroy()` —
  calling `destroy()` before setup resolves queues the cleanup rather than
  dropping it;
- catches errors thrown by `setup()` or the returned cleanup function and
  logs them with a `[PluginSDK:<runtimeKey>]` prefix instead of letting them
  crash the page;
- warns if you register the same `runtimeKey` twice (usually means two
  bundles loaded with a colliding key).

### `getPluginContext(props)` (formerly `usePluginContext`)

Extracts and validates runtime context from the props your `setup()`
receives.

```ts
function getPluginContext(props: PluginBaseProps): {
  runtimeKey: string;
  scopeType: PluginScopeType;
  scopeKey: string;
  sellerKey: string;
  tenantDomain: string;
  apiUrl: string;
};
```

Throws if `runtime_key`, `scope_type`, `scope_key`, `seller_key`, or
`tenant_domain` is missing from `props`.

> `usePluginContext` is kept as a deprecated alias for backwards
> compatibility. It is **not a React hook** — this SDK has no React
> dependency, and the name predates this rename. New code should use
> `getPluginContext`.

## GraphQL

### `pluginFetch(request, options)`

Sends a GraphQL request to the internal plugin proxy with variables
AES-GCM–encrypted (see [security.md](security.md)).

```ts
function pluginFetch<T = unknown>(
  request: { query: string; variables: Record<string, unknown> },
  options: { tenantDomain: string; runtimeKey: string; apiUrl?: string }
): Promise<{ data?: T; errors?: Array<{ message: string; extensions?: Record<string, unknown> }> }>;
```

`variables` is required — `pluginFetch` throws
`variables are required — use pluginFetchPublic for queries without variables`
if omitted. Times out after 15s. On a non-2xx response, throws with the
server's actual error message when the proxy returned one (it does, as
JSON, on 403/500), not just the bare HTTP status.

### `pluginFetchPublic(request, options)`

Same as `pluginFetch`, but sends `variables` in cleartext instead of
encrypting them. "Public" describes the *payload*, not the *auth* — it still
requires the same `tenantDomain`/`runtimeKey` and sends the same
`X-Tenant-Domain`/`X-Runtime-Key` headers the proxy checks. Use it only for
requests with no sensitive filter values.

### `submitPluginData(input, options)`

Built-in mutation for submitting plugin runtime data.

```ts
function submitPluginData(
  input: {
    runtime_key: string;
    scope_type: PluginDataScopeType; // 'product' | 'store' | 'global'
    scope_key: string;
    seller_key?: string;
    payload: Record<string, unknown>;
  },
  options: PluginGraphQLOptions
): Promise<PluginData>;
```

Throws before making any request if `scope_type === 'all_product_pages'` —
the server rejects that scope for submitted data specifically (it's valid
for the *instance's* installation scope, just not for data pinned to it).
`seller_key` is optional; the server field is nullable.

### `getPublicPluginData(params, options)`

Built-in query for reading a plugin's public data for a scope.

```ts
function getPublicPluginData(
  params: { runtime_key: string; scope_type: PluginDataScopeType; scope_key: string },
  options: PluginGraphQLOptions
): Promise<PluginData[]>;
```

### `encryptVariables(variables, tenantDomain, runtimeKey)`

Low-level encryption primitive. `pluginFetch` calls this for you — you only
need it directly if you're not using `pluginFetch` for some reason.

```ts
function encryptVariables(
  variables: Record<string, unknown>,
  tenantDomain: string,
  runtimeKey: string
): Promise<string>; // Base64(IV[12] | AuthTag[16] | Ciphertext)
```

Requires a secure context (`window.crypto.subtle` — HTTPS or localhost).
Throws a `[PluginSDK]`-prefixed error, rather than a cryptic native one, if
it isn't available, and if `tenantDomain`/`runtimeKey` are empty.

## Manifest authoring

### `defineManifest(manifest)`

Identity function for type-checked manifest authoring. See
[manifest.md](manifest.md).

### `SECTIONS`

The current, complete list of section slots swift-page renders plugins into:
`productDetailBelowTitle`, `productDetailRightTitle`,
`productDetailBelowDescription`, `etalaseBeforeSort`,
`landingPageHiddenState`. Use this instead of retyping the strings — see
[plugin-contract.md](plugin-contract.md#the-five-section-slots) for what each
one means.

## Utilities

### `escapeHtml(value)`

Escapes `& < > " '` for safe interpolation into `innerHTML`. Plugin data
(reviewer names, comments, anything round-tripped through
`submitPluginData`/`getPublicPluginData`) is untrusted by the time you
render it — the server doesn't sanitize for HTML context. See
[security.md](security.md#rendering-plugin-data-safely).

### `SDK_VERSION`

The SDK's own version string, baked in at build time. Useful for including
in error reports or a plugin's own debug panel.

## Types

All types below are exported from the package root.

| Type | Description |
| --- | --- |
| `PluginScopeType` | `'product' \| 'all_product_pages' \| 'store' \| 'global'` — valid scopes for a plugin *instance* |
| `PluginDataScopeType` | `PluginScopeType` minus `'all_product_pages'` — valid scopes for *submitted data* |
| `PluginSection` | Union of the five section slot names |
| `PluginBaseProps` | The props shape `setup()` receives |
| `PluginRuntimeContext` | The host-supplied subset of props (`runtime_key`, `scope_type`, `scope_key`, `seller_key`, `product?`) |
| `PluginTheme` | Storefront theme colors/fonts passed through `props.theme` |
| `PluginInstance` | `{ destroy(): void }` — what `createPlugin`'s mount function returns |
| `PluginDefinition<TProps>` | The object you pass to `createPlugin` |
| `SetupResult` | `(() => void) \| void` — what `setup()` may return |
| `MountFn<TProps>` | `(props: TProps, container: HTMLElement) => PluginInstance` |
| `GraphQLRequest` | `{ query: string; variables?: Record<string, unknown> }` |
| `GraphQLResponse<T>` | `{ data?: T; errors?: GraphQLError[] }` |
| `GraphQLError` | `{ message: string; extensions?: Record<string, unknown> }` |
| `PluginGraphQLOptions` | `{ tenantDomain: string; runtimeKey: string; apiUrl?: string }` |
| `DataSchema` / `DataSchemaField` | Manifest `data_schema` field shape — see [manifest.md](manifest.md#dataschema-field-shape) |
| `SubmitPluginDataInput` | Input to `submitPluginData` |
| `PluginData` | The record shape returned by `submitPluginData`/`getPublicPluginData` |
| `PluginManifest` / `PluginRulesSchema` | `manifest.json` shape — see [manifest.md](manifest.md) |
