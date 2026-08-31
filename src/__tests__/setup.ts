// The SDK is written for a browser environment (`window.crypto.subtle`,
// `window.btoa`, `window` as the plugin registration target). Node 20+
// exposes the same Web Crypto / encoding globals directly on `globalThis`,
// so tests run under plain Node by aliasing `window` to `globalThis` rather
// than pulling in a jsdom dependency that doesn't implement Web Crypto.
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
