import { encryptVariables } from '../crypto';
import type {
  GraphQLRequest,
  GraphQLResponse,
  PluginGraphQLOptions,
  SubmitPluginDataInput,
  PluginData,
  PluginDataScopeType,
} from '../types';

export const DEFAULT_API_URL = '/api/plugin/graphql';
const DEFAULT_TIMEOUT_MS = 15_000;

function formatErrors(errors: GraphQLResponse['errors']): string {
  if (!errors?.length) return 'Unknown GraphQL error';
  return errors.map((e) => e.message).join('; ');
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `[PluginSDK] Expected JSON from ${response.url || 'plugin API'} but got: ${text.slice(0, 200)}`
    );
  }
}

async function doFetch(
  apiUrl: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`[PluginSDK] Request to ${apiUrl} timed out after ${timeoutMs}ms`);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[PluginSDK] Network request to ${apiUrl} failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function handleResponse<T>(response: Response): Promise<GraphQLResponse<T>> {
  if (!response.ok) {
    // The proxy returns `{ errors: [...] }` as JSON on 403/500 — try to
    // surface that instead of just the bare status code.
    const body = await parseJsonResponse<GraphQLResponse<T>>(response).catch(() => null);
    if (body?.errors?.length) {
      throw new Error(`[PluginSDK] HTTP ${response.status}: ${formatErrors(body.errors)}`);
    }
    throw new Error(`[PluginSDK] HTTP ${response.status}: ${response.statusText}`);
  }

  return parseJsonResponse<GraphQLResponse<T>>(response);
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

/**
 * Send an encrypted GraphQL request to the Belanjaku internal plugin proxy.
 * Variables are AES-GCM encrypted before transmission.
 */
export async function pluginFetch<T = unknown>(
  request: GraphQLRequest,
  options: PluginGraphQLOptions
): Promise<GraphQLResponse<T>> {
  const { tenantDomain, runtimeKey, apiUrl = DEFAULT_API_URL } = options;

  if (!request.variables) {
    throw new Error(
      '[PluginSDK] variables are required — use pluginFetchPublic for queries without variables'
    );
  }

  const encryptedVariables = await encryptVariables(request.variables, tenantDomain, runtimeKey);

  const response = await doFetch(
    apiUrl,
    {
      'Content-Type': 'application/json',
      'X-Tenant-Domain': tenantDomain,
      'X-Runtime-Key': runtimeKey,
    },
    {
      query: request.query,
      tenant_domain: tenantDomain,
      variables: encryptedVariables,
    },
    DEFAULT_TIMEOUT_MS
  );

  return handleResponse<T>(response);
}

/**
 * Send a plain (unencrypted) GraphQL request. "Public" refers to the
 * payload — variables are sent in cleartext — not to authentication: the
 * proxy still requires `X-Tenant-Domain` and `X-Runtime-Key`, same as
 * pluginFetch(). Only use this for requests that don't need the encrypted
 * variables contract (e.g. no sensitive filter values).
 */
export async function pluginFetchPublic<T = unknown>(
  request: GraphQLRequest,
  options: PluginGraphQLOptions
): Promise<GraphQLResponse<T>> {
  const { tenantDomain, runtimeKey, apiUrl = DEFAULT_API_URL } = options;

  const response = await doFetch(
    apiUrl,
    {
      'Content-Type': 'application/json',
      'X-Tenant-Domain': tenantDomain,
      'X-Runtime-Key': runtimeKey,
    },
    request,
    DEFAULT_TIMEOUT_MS
  );

  return handleResponse<T>(response);
}

// ─── Built-in mutations & queries ─────────────────────────────────────────────
// Field selections are kept in lockstep with belanjaku-plugin-service
// graphql/types/plugin-data.graphql. There is no `status` field on
// PluginData — it was dropped server-side; do not add it back.

const SUBMIT_PLUGIN_DATA = /* GraphQL */ `
  mutation SubmitPluginData($input: SubmitPluginDataInput!) {
    submitPluginData(input: $input) {
      id
      runtime_key
      scope_type
      scope_key
      seller_key
      payload
      created_at
    }
  }
`;

const PUBLIC_PLUGIN_DATA = /* GraphQL */ `
  query PublicPluginData($runtime_key: String!, $scope_type: PluginScopeType!, $scope_key: String!) {
    pluginData(runtime_key: $runtime_key, scope_type: $scope_type, scope_key: $scope_key) {
      data {
        id
        runtime_key
        scope_type
        scope_key
        seller_key
        payload
        created_at
      }
    }
  }
`;

/**
 * Submit runtime data from a plugin widget. Accepts `scope_type: "product"
 * | "store" | "global"` — the server rejects `"all_product_pages"`
 * specifically, since submitted data must be pinned to a concrete scope
 * even if the plugin instance itself is installed platform-wide.
 */
export async function submitPluginData(
  input: SubmitPluginDataInput,
  options: PluginGraphQLOptions
): Promise<PluginData> {
  if ((input.scope_type as string) === 'all_product_pages') {
    throw new Error(
      `[PluginSDK] submitPluginData rejects scope_type="all_product_pages" — ` +
        'runtime data must be submitted per product, store, or global scope, even for a ' +
        'plugin instance installed platform-wide.'
    );
  }

  const result = await pluginFetch<{ submitPluginData: PluginData }>(
    { query: SUBMIT_PLUGIN_DATA, variables: { input } },
    options
  );

  if (result.errors?.length) {
    throw new Error(`[PluginSDK] GraphQL error: ${formatErrors(result.errors)}`);
  }
  if (!result.data) {
    throw new Error('[PluginSDK] submitPluginData: server returned no data');
  }

  return result.data.submitPluginData;
}

/**
 * Read public plugin data for a scope. `scope_type` must match whatever
 * scope the data was originally submitted under (see submitPluginData) —
 * "product" for most widgets, but "store" or "global" for plugins that
 * aggregate data at the seller or platform level.
 */
export async function getPublicPluginData(
  params: { runtime_key: string; scope_type: PluginDataScopeType; scope_key: string },
  options: PluginGraphQLOptions
): Promise<PluginData[]> {
  const variables = {
    runtime_key: params.runtime_key,
    scope_type: params.scope_type,
    scope_key: params.scope_key,
  };

  const result = await pluginFetch<{ pluginData: { data: PluginData[] } }>(
    { query: PUBLIC_PLUGIN_DATA, variables },
    options
  );

  if (result.errors?.length) {
    throw new Error(`[PluginSDK] GraphQL error: ${formatErrors(result.errors)}`);
  }

  return result.data?.pluginData?.data ?? [];
}
