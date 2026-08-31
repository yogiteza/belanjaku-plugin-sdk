# Security notes

## What the encryption is, and isn't, for

`encryptVariables()` / `pluginFetch()` encrypt GraphQL variables with
AES-256-GCM before they leave the browser. This is **request-integrity and
transport-obfuscation protection, not a secrecy boundary**:

- The encryption key is derived as `SHA-256(tenantDomain + ":" + runtimeKey)`
  — both inputs are values your plugin already has in the browser (and
  `tenantDomain` is often visible in the page URL). Anyone who can run
  JavaScript on the page — including your own plugin code, or another
  plugin on the same page — can derive the same key.
- It stops a casual observer of network traffic from reading request bodies
  and stops a request from being replayed against a different tenant/runtime
  pairing without the right key. It does **not** stop a determined attacker
  who controls the page, and it is not a substitute for server-side
  authorization.

Because of this, the server (plugin-service) **must** independently:

- validate the tenant the request claims to be for,
- validate `runtime_key` and `scope_key` against what's actually installed,
- authorize the seller/session making the request,
- validate `payload` against the plugin's own `data_schema`.

If you're extending the built-in `submitPluginData`/`getPublicPluginData`
with your own custom queries, don't treat "the request was encrypted" as
proof the request is legitimate — treat it the way you'd treat any
unauthenticated browser request, because that's what it is.

## Rendering plugin data safely

Anything that round-trips through `submitPluginData` /
`getPublicPluginData` — a reviewer's name, a comment, any payload field — is
user-submitted content by the time you read it back. The server does not
HTML-sanitize `payload`; it stores whatever `data_schema`-shaped JSON you
sent it.

If you build DOM with string templates and `innerHTML` (a common pattern for
small widgets), escape anything that came from `payload`:

```js
import { escapeHtml } from '@belanjaku/plugin-sdk';

container.innerHTML = `
  <strong>${escapeHtml(review.payload.name)}</strong>
  <p>${escapeHtml(review.payload.comment)}</p>
`;
```

Interpolating unescaped `payload` fields into `innerHTML` is a stored-XSS
pattern: one malicious review submission becomes a script that runs in every
other visitor's browser who views that product page. Prefer
`textContent`/DOM APIs over `innerHTML` where practical, and use
`escapeHtml()` wherever you can't avoid string templating.

## Reporting a vulnerability

If you find a security issue in this SDK, please report it privately rather
than opening a public issue — see [CONTRIBUTING.md](../CONTRIBUTING.md) for
contact details.
