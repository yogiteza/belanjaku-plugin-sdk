# @belanjaku/plugin-sdk

SDK for building storefront plugins for [swift-page](https://github.com/icube-id/swift-page), the Belanjaku
storefront app. A plugin is a small JavaScript bundle that swift-page loads
with a `<script>` tag and mounts into one of five fixed page slots — this SDK
gives you the registration boilerplate, an encrypted GraphQL client, and
TypeScript types for all of it.

## Install

```bash
npm install @belanjaku/plugin-sdk
```

## Quickstart

```js
import { createPlugin } from '@belanjaku/plugin-sdk';

createPlugin('MyWidget', {
  setup(props, container) {
    const root = document.createElement('div');
    root.textContent = `Hello from SKU: ${props.scope_key}`;
    container.appendChild(root);

    return () => root.remove(); // cleanup, called on unmount
  },
});
```

`setup` can also be `async` — the SDK awaits it before wiring up `destroy()`:

```js
import { createPlugin, getPluginContext, getPublicPluginData } from '@belanjaku/plugin-sdk';

createPlugin('ReviewWidget', {
  async setup(props, container) {
    const ctx = getPluginContext(props);
    const reviews = await getPublicPluginData(
      { runtime_key: ctx.runtimeKey, scope_key: ctx.scopeKey },
      { tenantDomain: ctx.tenantDomain, runtimeKey: ctx.runtimeKey, apiUrl: ctx.apiUrl }
    );

    container.textContent = `${reviews.length} reviews`;
    return () => {
      container.innerHTML = '';
    };
  },
});
```

Build that to a single IIFE bundle (not ESM — see
[docs/plugin-contract.md](docs/plugin-contract.md#the-bundle-must-be-an-iife)),
write a `manifest.json` next to it, and upload both to plugin-service. The
[examples/ReviewWidget](examples/ReviewWidget) directory is a complete,
buildable reference for this.

## What the SDK solves

| Without the SDK                                                             | With the SDK                                |
| --------------------------------------------------------------------------- | ------------------------------------------- |
| Hand-roll AES-GCM encryption matching the host's exact byte layout          | `pluginFetch()` encrypts for you            |
| Boilerplate `mount` / `destroy` / `window.SwiftpageComponents` registration | `createPlugin()`                            |
| Silently wrong `scope_type` on data submission                              | `submitPluginData()` validates it           |
| Manually extract and validate context from props                            | `getPluginContext()`                        |
| No visibility into what `manifest.json` fields mean                         | `defineManifest()` + typed `PluginManifest` |

## Documentation

- **[Plugin Field Guide](docs/plugin-field-guide.html)** — new to this system? Open this
  first: five diagrams covering the whole mechanism, no code required.
- **[Plugin contract](docs/plugin-contract.md)** — start here. How swift-page
  actually loads and mounts your bundle, the five page slots, and every
  silent-failure mode.
- **[Getting started](docs/getting-started.md)** — project layout, build
  setup, and the upload workflow end to end.
- **[Manifest reference](docs/manifest.md)** — every `manifest.json` field
  and how the upload service validates it.
- **[API reference](docs/api-reference.md)** — every exported function and
  type.
- **[Data & GraphQL](docs/data-and-graphql.md)** — the encrypted proxy,
  `submitPluginData`, `getPublicPluginData`.
- **[Security notes](docs/security.md)** — what the encryption does and
  doesn't protect against, and XSS guidance for rendering plugin data.
- **[Troubleshooting](docs/troubleshooting.md)** — the actual error strings
  the SDK and host throw, and the failures that don't throw at all.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
