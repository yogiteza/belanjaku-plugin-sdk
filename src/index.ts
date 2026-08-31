/**
 * @belanjaku/plugin-sdk
 *
 * SDK for building Belanjaku storefront plugins.
 *
 * Usage:
 *   import { createPlugin, getPluginContext, submitPluginData, pluginFetch } from '@belanjaku/plugin-sdk';
 *
 * See docs/ for the full guide — start with docs/plugin-contract.md to
 * understand how swift-page loads and mounts your plugin.
 */

// Core plugin factory
export { createPlugin, getPluginContext, usePluginContext } from './plugin';

// Encryption utility (re-exported for advanced use)
export { encryptVariables } from './crypto';

// GraphQL helpers
export {
  pluginFetch,
  pluginFetchPublic,
  submitPluginData,
  getPublicPluginData,
  DEFAULT_API_URL,
} from './graphql';

// Manifest authoring helpers
export { defineManifest, SECTIONS } from './manifest';

// Utilities
export { escapeHtml, SDK_VERSION } from './utils';

// Types
export type {
  PluginScopeType,
  PluginSection,
  PluginBaseProps,
  PluginRuntimeContext,
  PluginTheme,
  PluginInstance,
  PluginDefinition,
  SetupResult,
  MountFn,
  GraphQLRequest,
  GraphQLResponse,
  GraphQLError,
  PluginGraphQLOptions,
  DataSchema,
  DataSchemaField,
  SubmitPluginDataInput,
  PluginData,
} from './types';

export type { PluginManifest, PluginRulesSchema } from './manifest';
