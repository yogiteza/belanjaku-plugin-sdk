# Getting started

This walks through building and uploading a plugin end to end. Read
[plugin-contract.md](plugin-contract.md) first if you haven't — it explains
*why* the setup below looks the way it does.

## 1. Project layout

A plugin is a standalone package that depends on `@belanjaku/plugin-sdk` and
bundles to a single IIFE. There's no required framework or build tool — the
[examples/ReviewWidget](../examples/ReviewWidget) reference uses esbuild
because it's the least ceremony for "bundle one file to an IIFE," but Rollup,
webpack, or Vite's library mode all work equally well.

```text
my-widget/
├── manifest.json      ← plugin metadata; see manifest.md
├── package.json
├── build.mjs           ← or rollup.config.js / vite.config.js / webpack.config.js
└── src/
    └── index.js         ← createPlugin() call lives here

dist/                     ← build output, this is what you upload
├── manifest.json         ← copied from root
└── index.js               ← the IIFE bundle
```

## 2. Install the SDK

```bash
npm install @belanjaku/plugin-sdk
```

During local development against an unpublished SDK, point at it directly:

```json
{
  "dependencies": {
    "@belanjaku/plugin-sdk": "file:../../belanjaku-plugin-sdk"
  }
}
```

## 3. Write your plugin

```js
// src/index.js
import { createPlugin, getPluginContext, escapeHtml } from '@belanjaku/plugin-sdk';

createPlugin('MyWidget', {
  setup(props, container) {
    const ctx = getPluginContext(props);
    container.innerHTML = `<p>SKU: ${escapeHtml(ctx.scopeKey)}</p>`;
    return () => {
      container.innerHTML = '';
    };
  },
});
```

`runtimeKey` (the first argument to `createPlugin`) must:

- be a valid JavaScript identifier (`^[A-Za-z_$][A-Za-z0-9_$]*$`),
- match `manifest.json`'s `runtime_key` field exactly.

The SDK validates both of these at call time and throws if they're wrong,
rather than letting the mismatch surface as "my plugin doesn't appear."

## 4. Build to an IIFE

The one requirement your bundler config must satisfy: output format `iife`
(or `umd`), never `esm`. See
[plugin-contract.md](plugin-contract.md#the-bundle-must-be-an-iife) for why.

```js
// build.mjs
import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.js'],
  outfile: 'dist/index.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2017'],
  minify: true,
});
```

A good sanity check after building: `grep SwiftpageComponents dist/index.js`
— if that string isn't in your output, `createPlugin()` didn't run, and the
bundle won't register anything.

## 5. Write manifest.json

See [manifest.md](manifest.md) for the full field reference. Minimal example:

```json
{
  "runtime_key": "MyWidget",
  "name": "My Widget",
  "version": "1.0.0",
  "description": "A plugin that does something useful for at least thirty characters.",
  "entry": "index.js",
  "props_schema": {},
  "data_schema": {},
  "rules_schema": {
    "placements_available": {
      "productDetailBelowTitle": ["product"]
    },
    "plugin_data": {
      "config_seller": { "show_data": false, "action_data": { "action_add": false, "action_edit": false, "action_delete": false } },
      "config_customer": { "show_data": false, "action_data": { "action_add": false, "action_delete": false } }
    }
  }
}
```

Copy it into `dist/` alongside your bundle (or have your build script do it).

## 6. Upload

Zip the `dist/` directory (containing `manifest.json` at the root and your
entry file) and upload it through plugin-service. On success, plugin-service
assigns your bundle a hosted `entry_url` and the plugin becomes available for
an admin to place into one of the sections your manifest declared.

## 7. Verify it mounted

Open the page where it's placed, open devtools, and check:

```js
typeof window.SwiftpageComponents.MyWidget === 'function'
```

If that's `false` or the key is missing, see
[troubleshooting.md](troubleshooting.md) — this is the single most common
failure and it never throws an error you'll see in the console.
