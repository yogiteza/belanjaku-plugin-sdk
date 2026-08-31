import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlugin, getPluginContext } from '../plugin';
import type { PluginBaseProps } from '../types';

const baseProps: PluginBaseProps = {
  runtime_key: 'TestWidget',
  scope_type: 'product',
  scope_key: 'SKU-1',
  seller_key: 'vendor-1',
  tenant_domain: 'belanjaku.id',
};

function fakeContainer(): HTMLElement {
  // The SDK never calls DOM methods on `container` itself — it's handed
  // straight to `setup()` — so a plain object is a sufficient stand-in.
  return {} as HTMLElement;
}

/** Flush all pending microtasks (promise chains), not just one tick of them —
 * `createPlugin` chains several `.then()`s before `setup()` actually runs. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  delete (window as any).SwiftpageComponents;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createPlugin', () => {
  it('registers the mount function on window.SwiftpageComponents', () => {
    const mount = createPlugin('TestWidget', { setup: () => undefined });
    expect((window as any).SwiftpageComponents.TestWidget).toBe(mount);
  });

  it('rejects an invalid runtimeKey', () => {
    expect(() => createPlugin('', { setup: () => undefined })).toThrow(/runtimeKey/);
    expect(() => createPlugin('has-dash', { setup: () => undefined })).toThrow(/valid JavaScript identifier/);
  });

  it('rejects a definition without setup', () => {
    // @ts-expect-error deliberately invalid input
    expect(() => createPlugin('TestWidget', {})).toThrow(/definition.setup/);
  });

  it('warns and overwrites on duplicate registration', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createPlugin('TestWidget', { setup: () => undefined });
    createPlugin('TestWidget', { setup: () => undefined });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('already registered'));
  });

  it('runs the sync destroy function', async () => {
    const destroy = vi.fn();
    const mount = createPlugin('TestWidget', { setup: () => destroy });
    const instance = mount(baseProps, fakeContainer());

    // setup() resolution is deferred a microtask even when sync — give it a tick.
    await flush();

    instance.destroy();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('awaits an async setup before wiring destroy (regression: async setup used to leak)', async () => {
    const destroy = vi.fn();
    let resolveSetup!: (fn: () => void) => void;
    const setup = vi.fn(
      () =>
        new Promise<() => void>((resolve) => {
          resolveSetup = resolve;
        })
    );

    const mount = createPlugin('TestWidget', { setup });
    const instance = mount(baseProps, fakeContainer());

    // Let definition.setup() actually start running (it's invoked a few
    // microtask ticks after mount(), not synchronously) so resolveSetup gets
    // assigned by the Promise executor above.
    await flush();
    expect(setup).toHaveBeenCalledTimes(1);

    // destroy() called before the async setup resolves — must still clean up.
    instance.destroy();
    expect(destroy).not.toHaveBeenCalled();

    resolveSetup(destroy);
    await flush();

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('does not throw when a sync setup throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mount = createPlugin('TestWidget', {
      setup: () => {
        throw new Error('boom');
      },
    });

    const instance = mount(baseProps, fakeContainer());
    await flush();

    expect(() => instance.destroy()).not.toThrow();
    expect(error).toHaveBeenCalled();
  });

  it('does not throw when an async setup rejects', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mount = createPlugin('TestWidget', {
      setup: async () => {
        throw new Error('boom');
      },
    });

    const instance = mount(baseProps, fakeContainer());
    await flush();

    expect(() => instance.destroy()).not.toThrow();
    expect(error).toHaveBeenCalled();
  });

  it('warns and no-ops when mounted without a container', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mount = createPlugin('TestWidget', { setup: () => undefined });
    const instance = mount(baseProps, undefined as unknown as HTMLElement);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('without a container'));
    expect(() => instance.destroy()).not.toThrow();
  });

  it('merges default theme with a partial theme instead of overwriting it', async () => {
    let receivedProps: PluginBaseProps | undefined;
    const mount = createPlugin('TestWidget', {
      setup: (props) => {
        receivedProps = props;
      },
    });

    mount({ ...baseProps, theme: { primaryColor: '#ff0000' } }, fakeContainer());
    await flush();

    expect(receivedProps?.theme).toMatchObject({
      primaryColor: '#ff0000',
      textColor: '#222', // default preserved
      fontFamily: 'inherit', // default preserved
    });
  });

  it('falls back to the full default theme when theme is undefined', async () => {
    let receivedProps: PluginBaseProps | undefined;
    const mount = createPlugin('TestWidget', {
      setup: (props) => {
        receivedProps = props;
      },
    });

    mount({ ...baseProps, theme: undefined }, fakeContainer());
    await flush();

    expect(receivedProps?.theme).toEqual({
      textColor: '#222',
      buttonTextColor: '#fff',
      buttonBackgroundColor: '#000',
      buttonRadius: '6px',
      primaryColor: '#000',
      fontFamily: 'inherit',
    });
  });
});

describe('getPluginContext', () => {
  it('throws when a required field is missing', () => {
    const { seller_key, ...rest } = baseProps;
    expect(() => getPluginContext(rest as PluginBaseProps)).toThrow(/seller_key/);
  });

  it('returns camelCased context and defaults apiUrl', () => {
    const ctx = getPluginContext(baseProps);
    expect(ctx).toMatchObject({
      runtimeKey: 'TestWidget',
      scopeType: 'product',
      scopeKey: 'SKU-1',
      sellerKey: 'vendor-1',
      tenantDomain: 'belanjaku.id',
      apiUrl: '/api/plugin/graphql',
    });
  });
});
