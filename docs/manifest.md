# manifest.json reference

`manifest.json` is not read by the SDK at runtime — the SDK never opens it.
It's read by two things: the plugin-service upload endpoint, which validates
it and rejects your zip if it's wrong, and the seller admin UI, which uses
`props_schema` and `data_schema` to render config forms and data tables.

This reference mirrors the validation in plugin-service's
`PluginUploadService::validateManifest()`. If the server's validation ever
changes, that file is the source of truth, not this document.

You can author it as a plain JSON file, or in TypeScript with autocomplete
via the `defineManifest()` helper and `PluginManifest` type the SDK exports:

```ts
import { defineManifest, SECTIONS } from '@belanjaku/plugin-sdk';

export default defineManifest({
  runtime_key: 'ReviewWidget',
  // ...
});
```

`defineManifest()` is an identity function — it does no validation itself,
it only gives you type-checking and autocomplete while authoring. The real
validation happens server-side on upload.

## Top-level fields

| Field | Required | Rule |
| --- | --- | --- |
| `runtime_key` | Yes | Must match `^[A-Za-z_$][A-Za-z0-9_$]*$` (a valid JS identifier) and must match the key you pass to `createPlugin()`. |
| `name` | Yes | String, max 25 characters. |
| `version` | Yes | Semver, e.g. `"1.0.0"`. |
| `description` | Yes | At least 30 characters after stripping HTML tags. |
| `entry` | No (defaults to `"index.js"`) | Relative path inside your uploaded zip. Must not contain `..`. |
| `props_schema` | Yes | Object (may be `{}`). Config fields a seller can set per instance — theme overrides, feature flags, API keys. Shape is free-form; the admin UI renders it as a form. |
| `data_schema` | Yes | Object (may be `{}`). Describes the fields of data your plugin submits via `submitPluginData()`. See [`DataSchema`](api-reference.md#dataschema--dataschemafield). |
| `rules_schema` | Yes | Object — see below. |

## `rules_schema.placements_available`

Required, must be non-empty. Keys are section names (use the `SECTIONS`
constant rather than hardcoding strings — see
[plugin-contract.md](plugin-contract.md#the-five-section-slots) for what each
one means and its `scope_type`); values are non-empty arrays of
`scope_type` strings (`"product" | "all_product_pages" | "store" | "global"`)
that section is allowed to be installed for.

```json
"placements_available": {
  "productDetailBelowTitle": ["product", "all_product_pages"],
  "productDetailBelowDescription": ["product", "all_product_pages"]
}
```

## `rules_schema.plugin_data`

Controls whether sellers and customers can see/add/edit/delete the runtime
data your plugin submits via `submitPluginData()`. Both `config_seller` and
`config_customer` are required objects:

```json
"plugin_data": {
  "config_seller": {
    "show_data": true,
    "action_data": { "action_add": false, "action_edit": false, "action_delete": true }
  },
  "config_customer": {
    "show_data": true,
    "action_data": { "action_add": true, "action_delete": false }
  }
}
```

Note the asymmetry: sellers get `action_add` / `action_edit` / `action_delete`;
customers only get `action_add` / `action_delete` (no edit).

**If `data_schema` is empty**, every one of these boolean flags must be
`false` — the upload is rejected otherwise. This makes sense: there's nothing
to show/add/edit/delete if you never defined what the data looks like.

## `DataSchema` field shape

Each key in `data_schema` describes one field of the data your plugin
submits:

```ts
interface DataSchemaField {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime' | 'array' | 'object';
  label?: string;
  required?: boolean;
  table?: { visible?: boolean; sortable?: boolean; order?: number; width?: string };
  form?: string;   // e.g. "TextField" — admin form widget hint
  enum?: string[]; // allowed values, rendered as a select
}
```

Example, matching the reference `ReviewWidget`:

```json
"data_schema": {
  "rating": { "type": "number", "label": "Rating", "required": true, "table": { "visible": true, "sortable": true }, "form": "TextField" },
  "name": { "type": "string", "label": "Reviewer name", "required": true, "table": { "visible": true }, "form": "TextField" },
  "comment": { "type": "string", "label": "Review", "required": true, "table": { "visible": true }, "form": "TextField" }
}
```

## Full example

See [examples/ReviewWidget/manifest.json](../examples/ReviewWidget/manifest.json)
for a complete, working manifest that passes validation.
