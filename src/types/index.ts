// ─── Scope ─────────────────────────────────────────────────────────────────
// Mirrors the `PluginScopeType` enum in the plugin-service GraphQL schema
// (graphql/types/plugin-instance.graphql). Keep this in sync with the server.

export type PluginScopeType = 'product' | 'all_product_pages' | 'store' | 'global';

/**
 * scope_type values valid for *submitted runtime data*. A plugin instance
 * may be installed with `all_product_pages` scope, but the data it submits
 * must be pinned to a concrete scope — `PluginDataService::validateScopeType()`
 * server-side rejects `all_product_pages` here specifically, while accepting
 * it for instance placement (`PluginScopeType` above).
 */
export type PluginDataScopeType = Exclude<PluginScopeType, 'all_product_pages'>;

/**
 * The five section slots swift-page actually renders a plugin into.
 * Mirrors `ListSectionName` in plugin-instance.graphql. A manifest's
 * `rules_schema.placements_available` keys must be a subset of these.
 *
 * Note: `productDetailRightTitle` is `store`-scoped even though it renders
 * on the product detail page — its `scope_key` is the seller's vendor_code,
 * not the product SKU. See docs/plugin-contract.md.
 */
export type PluginSection =
  | 'productDetailBelowTitle'
  | 'productDetailRightTitle'
  | 'productDetailBelowDescription'
  | 'etalaseBeforeSort'
  | 'landingPageHiddenState';

// ─── Plugin Props & Context ───────────────────────────────────────────────────

export interface PluginRuntimeContext {
  runtime_key: string;
  scope_type: PluginScopeType;
  scope_key: string;
  seller_key: string;
  product?: Record<string, unknown>;
}

export interface PluginTheme {
  textColor?: string;
  buttonTextColor?: string;
  buttonBackgroundColor?: string;
  buttonRadius?: string;
  primaryColor?: string;
  fontFamily?: string;
}

export interface PluginBaseProps extends PluginRuntimeContext {
  slot?: string;
  api_url?: string;
  tenant_domain?: string;
  theme?: PluginTheme;
  [key: string]: unknown;
}

// ─── Plugin Lifecycle ─────────────────────────────────────────────────────────

export interface PluginInstance {
  destroy(): void;
}

export type MountFn<TProps extends PluginBaseProps = PluginBaseProps> = (
  props: TProps,
  container: HTMLElement
) => PluginInstance;

/** Return type accepted from `setup()` — a cleanup function, nothing, or a
 * promise of either. `setup` may be async; the SDK awaits it before treating
 * the plugin as mounted. See docs/plugin-contract.md#async-setup. */
export type SetupResult = (() => void) | void;

export interface PluginDefinition<TProps extends PluginBaseProps = PluginBaseProps> {
  setup(props: TProps, container: HTMLElement): SetupResult | Promise<SetupResult>;
}

// ─── GraphQL ──────────────────────────────────────────────────────────────────

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
}

export interface GraphQLError {
  message: string;
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: GraphQLError[];
}

export interface PluginGraphQLOptions {
  tenantDomain: string;
  runtimeKey: string;
  apiUrl?: string;
}

// ─── Schema types (manifest authoring) ────────────────────────────────────────
// See also src/manifest/index.ts for the full PluginManifest shape these
// fields belong to.

export interface DataSchemaField {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime' | 'array' | 'object';
  label?: string;
  required?: boolean;
  table?: { visible?: boolean; sortable?: boolean; order?: number; width?: string };
  form?: string;
  /** Allowed values, rendered as a select/enum in the admin form. */
  enum?: string[];
}

export interface DataSchema {
  [fieldKey: string]: DataSchemaField;
}

export interface SubmitPluginDataInput {
  runtime_key: string;
  /** Must not be "all_product_pages" — see submitPluginData() in
   * src/graphql/index.ts and {@link PluginDataScopeType}. */
  scope_type: PluginDataScopeType;
  scope_key: string;
  /** Seller vendor_code. Required when the plugin instance is installed
   * with `all_product_pages` scope but data is submitted per product;
   * optional otherwise — the server field is nullable. */
  seller_key?: string;
  payload: Record<string, unknown>;
}

export interface PluginData {
  id: string;
  runtime_key: string;
  scope_type: string;
  scope_key: string;
  /** Nullable server-side — not guaranteed present, e.g. getPublicPluginData()
   * does not select it. */
  seller_key?: string;
  payload: Record<string, unknown>;
  created_at?: string;
}
