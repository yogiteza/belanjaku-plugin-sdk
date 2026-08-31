# ReviewWidget example

A complete, buildable reference plugin showing:

- `createPlugin()` with an async `setup()`
- `getPluginContext()` to extract runtime context from props
- `getPublicPluginData()` / `submitPluginData()` for reading and writing
  plugin data
- `escapeHtml()` for safely rendering user-submitted review text
- Two slots (`summary` / `comments`) driven by `props.slot`, matching
  `manifest.json`'s `productDetailBelowTitle` / `productDetailBelowDescription`
  placements
- A `manifest.json` that passes plugin-service's upload validation
- A build script (`build.mjs`) producing the IIFE bundle swift-page requires

See [../../docs/getting-started.md](../../docs/getting-started.md) for the
full walkthrough this example follows.

## Build

```bash
npm install
npm run build
```

Produces `dist/index.js` (minified IIFE) and `dist/manifest.json`. Zip the
`dist/` directory and upload it to plugin-service.

## Local sanity check

After building, confirm the bundle actually registers itself:

```bash
grep -o SwiftpageComponents dist/index.js
```

Or load `dist/index.js` in a browser console and check
`typeof window.SwiftpageComponents.ReviewWidget === 'function'`.
