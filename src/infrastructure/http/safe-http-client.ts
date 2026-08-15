import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { ExternalServiceError, ValidationError } from '../../core/errors/app-error.js';

export interface HttpClientOptions {
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  readonly userAgent?: string;
}

export interface HttpDependencies {
  readonly fetcher?: typeof fetch;
  readonly resolve?: (hostname: string) => Promise<readonly string[]>;
}

export interface RequestOptions {
  readonly method?: 'GET' | 'POST';
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: BodyInit;
  readonly allowedHosts?: readonly string[];
  readonly maxResponseBytes?: number;
}

const isPrivateIpv4 = (address: string): boolean => {
  const parts = address.split('.').map(Number);
  const first = parts[0] ?? -1;
  const second = parts[1] ?? -1;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
};

const isPrivateIpv6 = (address: string): boolean => {
  const normalized = address.toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
};

export const isPrivateAddress = (address: string): boolean => {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
};

const readLimitedBody = async (response: Response, maxBytes: number): Promise<Uint8Array> => {
  const declaredSize = Number(response.headers.get('content-length') ?? 0);
  if (declaredSize > maxBytes) {
    throw new ValidationError('A resposta remota excede o tamanho permitido.', {
      maxBytes,
      declaredSize,
    });
  }
  if (response.body === null) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ValidationError('A resposta remota excede o tamanho permitido.', {
        maxBytes,
      });
    }
    chunks.push(value);
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
};

export class SafeHttpClient {
  private readonly fetcher: typeof fetch;
  private readonly resolve: (hostname: string) => Promise<readonly string[]>;

  public constructor(
    private readonly options: HttpClientOptions,
    dependencies: HttpDependencies = {},
  ) {
    this.fetcher = dependencies.fetcher ?? globalThis.fetch;
    this.resolve =
      dependencies.resolve ??
      (async (hostname) =>
        (await lookup(hostname, { all: true, verbatim: true })).map(({ address }) => address));
  }

  public async request(urlValue: string | URL, options: RequestOptions = {}): Promise<Response> {
    let url = new URL(urlValue);
    for (let redirect = 0; redirect <= 3; redirect += 1) {
      await this.validateUrl(url, options.allowedHosts);
      const response = await this.fetcher(url, {
        method: options.method ?? 'GET',
        headers: {
          'user-agent': this.options.userAgent ?? 'Wardizitto/2.0',
          ...options.headers,
        },
        ...(options.body === undefined ? {} : { body: options.body }),
        redirect: 'manual',
        signal: AbortSignal.timeout(this.options.timeoutMs),
      }).catch((error: unknown) => {
        throw new ExternalServiceError('http', 'Falha na solicitação externa.', {
          cause: error,
          retryable: true,
        });
      });

      if (response.status < 300 || response.status >= 400) return response;
      const location = response.headers.get('location');
      if (location === null) return response;
      url = new URL(location, url);
    }
    throw new ExternalServiceError('http', 'Limite de redirecionamentos excedido.');
  }

  public async getBuffer(url: string | URL, options: RequestOptions = {}): Promise<Buffer> {
    const response = await this.request(url, options);
    if (!response.ok) {
      throw new ExternalServiceError(
        'http',
        `Serviço remoto respondeu HTTP ${String(response.status)}.`,
        {
          details: { status: response.status },
        },
      );
    }
    const bytes = await readLimitedBody(
      response,
      options.maxResponseBytes ?? this.options.maxResponseBytes,
    );
    return Buffer.from(bytes);
  }

  public async getJson<T>(url: string | URL, options: RequestOptions = {}): Promise<T> {
    const buffer = await this.getBuffer(url, options);
    try {
      return JSON.parse(buffer.toString('utf8')) as T;
    } catch (error) {
      throw new ExternalServiceError('http', 'O serviço remoto retornou JSON inválido.', {
        cause: error,
      });
    }
  }

  private async validateUrl(url: URL, allowedHosts?: readonly string[]): Promise<void> {
    if (url.protocol !== 'https:') {
      throw new ValidationError('Apenas URLs HTTPS são permitidas.');
    }
    if (url.username !== '' || url.password !== '') {
      throw new ValidationError('URLs com credenciais não são permitidas.');
    }
    if (url.port !== '' && url.port !== '443') {
      throw new ValidationError('Porta não permitida para solicitação externa.');
    }
    const hostname = url.hostname.toLowerCase();
    if (allowedHosts !== undefined && !allowedHosts.includes(hostname)) {
      throw new ValidationError('O host remoto não está na allowlist.', { hostname });
    }
    const addresses = await this.resolve(hostname);
    if (addresses.length === 0 || addresses.some((address) => isPrivateAddress(address))) {
      throw new ValidationError('O host remoto resolve para uma rede privada ou reservada.', {
        hostname,
      });
    }
  }
}
