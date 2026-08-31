import type { PluginBaseProps, PluginDefinition, PluginInstance, MountFn, PluginTheme } from '../types';
import { DEFAULT_API_URL } from '../graphql';

const REGISTRY_KEY = 'SwiftpageComponents';

// Must match belanjaku-plugin-service PluginUploadService::RUNTIME_KEY_PATTERN —
// runtime_key has to be a valid JS identifier, both here and in manifest.json.
const RUNTIME_KEY_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const DEFAULT_THEME: Required<PluginTheme> = {
  textColor: '#222',
  buttonTextColor: '#fff',
  buttonBackgroundColor: '#000',
  buttonRadius: '6px',
  primaryColor: '#000',
  fontFamily: 'inherit',
};

declare global {
  interface Window {
    [REGISTRY_KEY]?: Record<string, MountFn>;
  }
}

function normalizeProps<TProps extends PluginBaseProps>(props: TProps): TProps {
  return {
    ...props,
    api_url: props.api_url ?? DEFAULT_API_URL,
    tenant_domain: props.tenant_domain ?? '',
    slot: props.slot ?? '',
    theme: { ...DEFAULT_THEME, ...props.theme },
  };
}

// ─── createPlugin ─────────────────────────────────────────────────────────────

/**
 * Define and register a Belanjaku plugin widget.
 *
 * Handles:
 * - Registration on `window.SwiftpageComponents[runtime_key]`, the global
 *   registry swift-page reads plugins from (see docs/plugin-contract.md)
 * - The mount / destroy lifecycle, including an async `setup()`
 * - Normalizing props with defaults (`api_url`, `tenant_domain`, `slot`, `theme`)
 * - Guarding against a missing container and errors thrown during setup/destroy
 *
 * @example
 * ```js
 * import { createPlugin } from '@belanjaku/plugin-sdk';
 *
 * createPlugin('ReviewWidget', {
 *   setup(props, container) {
 *     const root = document.createElement('div');
 *     root.textContent = `SKU: ${props.scope_key}`;
 *     container.appendChild(root);
 *
 *     return () => root.remove(); // destroy fn
 *   }
 * });
 * ```
 *
 * `setup` may also be `async` and return its cleanup function once ready —
 * the SDK awaits it before wiring up `destroy()`:
 * ```js
 * createPlugin('ReviewWidget', {
 *   async setup(props, container) {
 *     const reviews = await getPublicPluginData(...);
 *     render(container, reviews);
 *     return () => { container.innerHTML = ''; };
 *   }
 * });
 * ```
 */
export function createPlugin<TProps extends PluginBaseProps = PluginBaseProps>(
  runtimeKey: string,
  definition: PluginDefinition<TProps>
): MountFn<TProps> {
  if (!runtimeKey || typeof runtimeKey !== 'string') {
    throw new Error('[PluginSDK] createPlugin requires a non-empty string runtimeKey');
  }
  if (!RUNTIME_KEY_PATTERN.test(runtimeKey)) {
    throw new Error(
      `[PluginSDK] runtimeKey "${runtimeKey}" is not a valid JavaScript identifier. ` +
        "It must match ^[A-Za-z_$][A-Za-z0-9_$]*$ and match manifest.json's runtime_key."
    );
  }
  if (!definition || typeof definition.setup !== 'function') {
    throw new Error(`[PluginSDK:${runtimeKey}] createPlugin requires definition.setup to be a function`);
  }

  const mount: MountFn<TProps> = (props, container): PluginInstance => {
    if (!container) {
      console.warn(`[PluginSDK:${runtimeKey}] mount called without a container`);
      return { destroy() {} };
    }

    const normalizedProps = normalizeProps(props);

    let cleanup: (() => void) | void;
    let ready = false;
    let destroyRequested = false;
    let alreadyDestroyed = false;

    const runCleanup = () => {
      if (alreadyDestroyed) return;
      alreadyDestroyed = true;
      try {
        if (typeof cleanup === 'function') cleanup();
      } catch (err) {
        console.error(`[PluginSDK:${runtimeKey}] destroy threw an error:`, err);
      }
    };

    // Wrapping in Promise.resolve().then(...) handles sync and async
    // `setup()` uniformly: a synchronous throw becomes a rejection here too,
    // and the returned PluginInstance is available immediately either way.
    Promise.resolve()
      .then(() => definition.setup(normalizedProps, container))
      .then((result) => {
        cleanup = result;
        ready = true;
        if (destroyRequested) runCleanup();
      })
      .catch((err) => {
        console.error(`[PluginSDK:${runtimeKey}] setup threw an error:`, err);
        ready = true;
      });

    return {
      destroy() {
        destroyRequested = true;
        if (ready) runCleanup();
      },
    };
  };

  // Register on window.SwiftpageComponents
  if (typeof window !== 'undefined') {
    window[REGISTRY_KEY] = window[REGISTRY_KEY] || {};
    if (window[REGISTRY_KEY]![runtimeKey]) {
      console.warn(
        `[PluginSDK:${runtimeKey}] a plugin is already registered under this runtime_key — ` +
          'it is being overwritten. This usually means two bundles were loaded with the same runtime_key.'
      );
    }
    // The registry holds MountFn for many different runtime_keys, each with
    // its own TProps — genuinely heterogeneous, so this one cast (rather
    // than typing the whole module `any`) is the actual variance boundary.
    window[REGISTRY_KEY]![runtimeKey] = mount as unknown as MountFn;
  }

  return mount;
}

// ─── getPluginContext ──────────────────────────────────────────────────────────

/**
 * Extract and validate runtime context from plugin props.
 * Throws if required context fields are missing.
 */
export function getPluginContext(props: PluginBaseProps) {
  const { runtime_key, scope_type, scope_key, seller_key, tenant_domain, api_url } = props;

  if (!runtime_key) throw new Error('[PluginSDK] props.runtime_key is missing');
  if (!scope_type) throw new Error('[PluginSDK] props.scope_type is missing');
  if (!scope_key) throw new Error('[PluginSDK] props.scope_key is missing');
  if (!seller_key) throw new Error('[PluginSDK] props.seller_key is missing');
  if (!tenant_domain) throw new Error('[PluginSDK] props.tenant_domain is missing');

  return {
    runtimeKey: runtime_key,
    scopeType: scope_type,
    scopeKey: scope_key,
    sellerKey: seller_key,
    tenantDomain: tenant_domain,
    apiUrl: api_url ?? DEFAULT_API_URL,
  } as const;
}

/**
 * @deprecated Use {@link getPluginContext} instead. This function is not a
 * React hook — the SDK has no React dependency — and the `use`-prefixed name
 * is misleading. Kept as an alias for backwards compatibility.
 */
export const usePluginContext = getPluginContext;
