import type { DataSchema, PluginScopeType, PluginSection } from '../types';

/**
 * manifest.json — the file the plugin upload service validates and stores
 * alongside your bundle. It is not read by the SDK at runtime; it is read by
 * the server when you upload, and by the seller admin UI to render config
 * forms and data tables. See docs/manifest.md for the full field reference.
 *
 * This type mirrors the validation in
 * belanjaku-plugin-service `App\Services\PluginUploadService::validateManifest()`.
 * Keep it in sync with that file if the server contract changes.
 */
export interface PluginManifest {
  /** Must match `^[A-Za-z_$][A-Za-z0-9_$]*$` — a valid JS identifier, and
   * must match the key passed to `createPlugin()`. */
  runtime_key: string;
  /** Max 25 characters. */
  name: string;
  /** Semver, e.g. "1.0.0". */
  version: string;
  /** At least 30 characters after stripping HTML tags. */
  description: string;
  /** Relative path to the entry file inside the uploaded zip. Defaults to
   * "index.js". Must not contain "..". */
  entry?: string;
  /** Config fields the seller admin can set per plugin instance (theme
   * overrides, API keys, feature flags, ...). Keyed object, values describe
   * form fields — shape is up to the admin UI, not fixed by the SDK. */
  props_schema: Record<string, unknown>;
  /** Fields of runtime data your plugin stores via submitPluginData(), shown
   * as columns/forms in the seller admin. Leave `{}` if your plugin never
   * calls submitPluginData() — but then every action in
   * rules_schema.plugin_data must be `false`, or upload is rejected. */
  data_schema: DataSchema;
  rules_schema: PluginRulesSchema;
}

export interface PluginRulesSchema {
  /** Which sections this plugin may be placed into, and for which scope
   * types. Keys must be values from PluginSection; each value is a
   * non-empty list of PluginScopeType. Required, must not be empty. */
  placements_available: Partial<Record<PluginSection, PluginScopeType[]>>;
  plugin_data: {
    config_seller: PluginDataActions & {
      action_data: { action_add: boolean; action_edit: boolean; action_delete: boolean };
    };
    config_customer: PluginDataActions & { action_data: { action_add: boolean; action_delete: boolean } };
  };
}

interface PluginDataActions {
  /** Whether this role sees submitted plugin data at all in the admin UI. */
  show_data: boolean;
}

/**
 * Identity helper for authoring `manifest.json` in TypeScript with
 * autocomplete and type-checking, e.g. in a `manifest.ts` that you
 * `JSON.stringify()` at build time. Performs no validation itself — the
 * upload service is the source of truth and validates on upload.
 */
export function defineManifest(manifest: PluginManifest): PluginManifest {
  return manifest;
}

/** The complete, current set of section slots swift-page renders plugins
 * into. Use these instead of hardcoding strings in
 * `rules_schema.placements_available`. */
export const SECTIONS: readonly PluginSection[] = [
  'productDetailBelowTitle',
  'productDetailRightTitle',
  'productDetailBelowDescription',
  'etalaseBeforeSort',
  'landingPageHiddenState',
];
