import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pluginFetch, pluginFetchPublic, submitPluginData, getPublicPluginData } from '../graphql';

const options = { tenantDomain: 'belanjaku.id', runtimeKey: 'ReviewWidget' };

function mockFetchOnce(response: Partial<Response> & { json: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(await response.json()),
    ...response,
  } as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pluginFetch', () => {
  it('sends X-Tenant-Domain and X-Runtime-Key headers with encrypted variables', async () => {
    const fetchMock = mockFetchOnce({ json: async () => ({ data: { ok: true } }) });

    await pluginFetch({ query: 'query { ok }', variables: { a: 1 } }, options);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['X-Tenant-Domain']).toBe('belanjaku.id');
    expect(init.headers['X-Runtime-Key']).toBe('ReviewWidget');
    const body = JSON.parse(init.body);
    expect(typeof body.variables).toBe('string'); // encrypted, not plaintext
  });

  it('requires variables', async () => {
    await expect(pluginFetch({ query: 'query { ok }' }, options)).rejects.toThrow('variables are required');
  });

  it('surfaces the server error message on a non-ok response instead of just the status', async () => {
    mockFetchOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ errors: [{ message: 'X-Runtime-Key header is required' }] }),
    });

    await expect(pluginFetch({ query: 'query { ok }', variables: {} }, options)).rejects.toThrow(
      'X-Runtime-Key header is required'
    );
  });
});

describe('pluginFetchPublic', () => {
  it('also sends X-Runtime-Key (regression: used to omit it and always get a 403)', async () => {
    const fetchMock = mockFetchOnce({ json: async () => ({ data: { ok: true } }) });

    await pluginFetchPublic({ query: 'query { ok }' }, options);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['X-Runtime-Key']).toBe('ReviewWidget');
    expect(init.headers['X-Tenant-Domain']).toBe('belanjaku.id');
  });
});

describe('built-in query shape (regression: server dropped PluginData.status)', () => {
  it('submitPluginData does not select a status field', async () => {
    const fetchMock = mockFetchOnce({
      json: async () => ({ data: { submitPluginData: { id: '1' } } }),
    });

    await submitPluginData(
      {
        runtime_key: 'ReviewWidget',
        scope_type: 'product',
        scope_key: 'SKU-1',
        seller_key: 'v1',
        payload: {},
      },
      options
    );

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.query).not.toMatch(/\bstatus\b/);
  });

  it('getPublicPluginData does not select a status field', async () => {
    const fetchMock = mockFetchOnce({
      json: async () => ({ data: { pluginData: { data: [] } } }),
    });

    await getPublicPluginData(
      { runtime_key: 'ReviewWidget', scope_type: 'product', scope_key: 'SKU-1' },
      options
    );

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.query).not.toMatch(/\bstatus\b/);
  });

  it('submitPluginData rejects scope_type="all_product_pages" (server-confirmed: product/store/global are all valid)', async () => {
    await expect(
      submitPluginData(
        {
          runtime_key: 'ReviewWidget',
          // @ts-expect-error deliberately invalid input
          scope_type: 'all_product_pages',
          scope_key: 'SKU-1',
          seller_key: 'v1',
          payload: {},
        },
        options
      )
    ).rejects.toThrow('rejects scope_type="all_product_pages"');
  });

  it.each(['product', 'store', 'global'] as const)(
    'submitPluginData accepts scope_type="%s"',
    async (scopeType) => {
      mockFetchOnce({ json: async () => ({ data: { submitPluginData: { id: '1' } } }) });

      await expect(
        submitPluginData(
          { runtime_key: 'ReviewWidget', scope_type: scopeType, scope_key: 'SKU-1', payload: {} },
          options
        )
      ).resolves.toBeDefined();
    }
  );

  it.each(['product', 'store', 'global'] as const)(
    'getPublicPluginData accepts scope_type="%s"',
    async (scopeType) => {
      const fetchMock = mockFetchOnce({ json: async () => ({ data: { pluginData: { data: [] } } }) });

      // variables are AES-GCM encrypted before transmission (see crypto.test.ts
      // for the round-trip check) — here we only confirm the call goes through
      // for each non-all_product_pages scope, matching PluginDataService::validateScopeType.
      await expect(
        getPublicPluginData(
          { runtime_key: 'ReviewWidget', scope_type: scopeType, scope_key: 'SKU-1' },
          options
        )
      ).resolves.toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );
});
