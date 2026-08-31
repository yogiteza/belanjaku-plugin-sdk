/**
 * Escape a string for safe interpolation into `innerHTML`. Plugin data
 * (reviewer names, comments, any submitted payload field) is untrusted user
 * input by the time it comes back from getPublicPluginData() — the server
 * does not sanitize it for HTML context, only your plugin can.
 *
 * @example
 * ```js
 * container.innerHTML = `<strong>${escapeHtml(review.payload.name)}</strong>`;
 * ```
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

// Substituted with the real version string at build time by
// @rollup/plugin-replace (see rollup.config.mjs) — this declaration only
// exists so `tsc --noEmit` (which doesn't run through rollup) can typecheck it.
declare const __SDK_VERSION__: string;

/** SDK version, read back from package.json at build time (see
 * rollup.config.mjs). Useful for including in error reports or a plugin's own
 * about/debug panel. */
export const SDK_VERSION: string = __SDK_VERSION__;
