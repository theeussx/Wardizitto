import { describe, expect, it, vi } from 'vitest';

import { ExternalServiceError, ValidationError } from '../../src/core/errors/app-error.js';
import { SafeHttpClient } from '../../src/infrastructure/http/safe-http-client.js';

const createClient = (
  fetcher: typeof fetch,
  addresses: readonly string[] = ['8.8.8.8'],
): SafeHttpClient =>
  new SafeHttpClient(
    { timeoutMs: 1_000, maxResponseBytes: 100, userAgent: 'test' },
    { fetcher, resolve: () => Promise.resolve(addresses) },
  );

describe('SafeHttpClient', () => {
  it('lê JSON e envia cabeçalhos padronizados', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json', 'content-length': '11' },
      }),
    );
    const client = createClient(fetcher);

    await expect(
      client.getJson<{ ok: boolean }>('https://api.example.com/data', {
        allowedHosts: ['api.example.com'],
      }),
    ).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('segue redirect validando novamente o destino', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/final' } }))
      .mockResolvedValueOnce(new Response('done'));
    const client = createClient(fetcher);

    await expect(client.getBuffer('https://example.com/start')).resolves.toEqual(
      Buffer.from('done'),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejeita protocolos, credenciais, portas, hosts e redes privadas', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createClient(fetcher);
    await expect(client.request('http://example.com')).rejects.toBeInstanceOf(ValidationError);
    await expect(client.request('https://user:pass@example.com')).rejects.toThrow('credenciais');
    await expect(client.request('https://example.com:8443')).rejects.toThrow('Porta');
    await expect(
      client.request('https://example.com', { allowedHosts: ['allowed.example.com'] }),
    ).rejects.toThrow('allowlist');
    await expect(
      createClient(fetcher, ['127.0.0.1']).request('https://example.com'),
    ).rejects.toThrow('privada');
    await expect(createClient(fetcher, []).request('https://example.com')).rejects.toThrow(
      'privada',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('limita resposta por Content-Length e por streaming', async () => {
    const declared = createClient(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('small', { headers: { 'content-length': '101' } })),
    );
    await expect(declared.getBuffer('https://example.com')).rejects.toThrow('tamanho');

    const streamed = createClient(
      vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(101))),
    );
    await expect(streamed.getBuffer('https://example.com')).rejects.toThrow('tamanho');
  });

  it('normaliza falhas HTTP, de rede e JSON inválido', async () => {
    const unavailable = createClient(
      vi.fn<typeof fetch>().mockResolvedValue(new Response('no', { status: 503 })),
    );
    await expect(unavailable.getBuffer('https://example.com')).rejects.toBeInstanceOf(
      ExternalServiceError,
    );

    const offline = createClient(vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')));
    await expect(offline.request('https://example.com')).rejects.toBeInstanceOf(
      ExternalServiceError,
    );

    const invalidJson = createClient(
      vi.fn<typeof fetch>().mockResolvedValue(new Response('not json')),
    );
    await expect(invalidJson.getJson('https://example.com')).rejects.toThrow('JSON inválido');
  });
});
