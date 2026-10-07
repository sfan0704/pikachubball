import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createAppErrorHandler, createServerDependencies } from '../../../server/composition-root';
import { SupabaseOwnerStorage } from '../../../server/storage/supabase-owner-storage';
import { buildTestConfig, buildTestDependencies } from '../../support/dependencies';

describe('createServerDependencies', () => {
  it('gives every collaborator the configuration it needs', () => {
    const config = buildTestConfig();
    const dependencies = createServerDependencies(config);

    expect(dependencies.config).toBe(config);
    expect(typeof dependencies.logger.info).toBe('function');
    expect(typeof dependencies.createSupabaseClient).toBe('function');
    expect(typeof dependencies.createYahooClient).toBe('function');
  });

  it('builds owner-scoped storage with the configured encryption key', () => {
    const dependencies = createServerDependencies(buildTestConfig());
    const client = {} as never;

    const storage = dependencies.createOwnerStorage(client, 'owner-1');

    expect(storage).toBeInstanceOf(SupabaseOwnerStorage);
  });

  it('refuses an encryption key that is not 32 bytes', () => {
    expect(() => createServerDependencies(buildTestConfig({ encryptionKey: 'abcd' }))).toThrow(
      /64 hexadecimal characters/,
    );
  });

  it('builds a Supabase client for the request from the auth configuration', () => {
    const dependencies = createServerDependencies(buildTestConfig());
    const req = { headers: {} } as Request;
    const res = { append: vi.fn() } as unknown as Response;

    const client = dependencies.createSupabaseClient(req, res);

    expect(typeof client.auth.getUser).toBe('function');
  });

  it('refuses to create a Yahoo client when the Yahoo app is not configured', async () => {
    const dependencies = createServerDependencies(
      buildTestConfig({ yahoo: { clientId: null, clientSecret: null, providerRedirectUri: null } }),
    );

    await expect(dependencies.createYahooClient('user-1', {} as never)).rejects.toThrow(
      /credentials are not configured/,
    );
  });
});

describe('createAppErrorHandler', () => {
  function respondTo(nodeEnv: 'development' | 'production') {
    const dependencies = buildTestDependencies({ config: buildTestConfig({ nodeEnv }) });
    const handler = createAppErrorHandler(dependencies);
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json } as unknown as Response;
    handler(new Error('boom'), { requestId: 'r1' } as Request, res, vi.fn());
    return json.mock.calls[0][0];
  }

  it('shows the message and stack of unexpected errors only in development', () => {
    expect(respondTo('development').details).toMatchObject({ message: 'boom' });
    expect(respondTo('production')).not.toHaveProperty('details');
  });
});
