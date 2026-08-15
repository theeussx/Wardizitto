import { isIP } from 'node:net';

import { ExternalServiceError, ValidationError } from '../../core/errors/app-error.js';
import { requireHttpUrl } from '../../core/security/content.js';
import type { SafeHttpClient } from '../http/safe-http-client.js';

interface VirusTotalEnvelope<T = Readonly<Record<string, unknown>>> {
  readonly data: T;
}

interface AnalysisData {
  readonly id?: string;
  readonly attributes?: { readonly status?: string };
  readonly [key: string]: unknown;
}

let apiKey: string | undefined;
let http: SafeHttpClient | undefined;

export const configureVirusTotal = (key: string | undefined, client: SafeHttpClient): void => {
  apiKey = key;
  http = client;
};

const integration = (): { readonly key: string; readonly client: SafeHttpClient } => {
  if (apiKey === undefined || apiKey === '') {
    throw new ExternalServiceError('virustotal', 'A integração VirusTotal não está configurada.', {
      code: 'INTEGRATION_NOT_CONFIGURED',
    });
  }
  if (http === undefined) throw new Error('SafeHttpClient não configurado.');
  return { key: apiKey, client: http };
};

const apiJson = async <T>(path: string): Promise<T> => {
  const { key, client } = integration();
  const envelope = await client.getJson<VirusTotalEnvelope<T>>(
    `https://www.virustotal.com/api/v3/${path}`,
    { headers: { 'x-apikey': key }, allowedHosts: ['www.virustotal.com'] },
  );
  return envelope.data;
};

export const uploadFileToVirusTotal = async (fileUrl: string): Promise<AnalysisData> => {
  const { key, client } = integration();
  const file = await client.getBuffer(fileUrl, {
    allowedHosts: ['cdn.discordapp.com', 'media.discordapp.net'],
    maxResponseBytes: 10 * 1_024 * 1_024,
  });
  const form = new FormData();
  form.append('file', new Blob([Uint8Array.from(file)]), 'discord-upload');
  const response = await client.request('https://www.virustotal.com/api/v3/files', {
    method: 'POST',
    headers: { 'x-apikey': key },
    body: form,
    allowedHosts: ['www.virustotal.com'],
  });
  if (!response.ok) {
    throw new ExternalServiceError(
      'virustotal',
      `Upload recusado (HTTP ${String(response.status)}).`,
    );
  }
  const envelope = (await response.json()) as VirusTotalEnvelope<AnalysisData>;
  return envelope.data;
};

export const analyzeUrl = async (value: string): Promise<AnalysisData> => {
  const url = requireHttpUrl(value);
  const encoded = Buffer.from(url.href).toString('base64url');
  return apiJson<AnalysisData>(`urls/${encoded}`);
};

export const analyzeIP = async (ip: string): Promise<AnalysisData> => {
  if (isIP(ip) === 0) throw new ValidationError('Endereço IP inválido.');
  return apiJson<AnalysisData>(`ip_addresses/${encodeURIComponent(ip)}`);
};

export const analyzeDomain = async (domain: string): Promise<AnalysisData> => {
  const normalized = domain.trim().toLowerCase();
  if (
    normalized.length > 253 ||
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(normalized)
  ) {
    throw new ValidationError('Domínio inválido.');
  }
  return apiJson<AnalysisData>(`domains/${normalized}`);
};

export const fetchAnalysis = async (id: string): Promise<AnalysisData> => {
  if (!/^[A-Za-z0-9_-]{1,200}$/u.test(id)) throw new ValidationError('ID de análise inválido.');
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const analysis = await apiJson<AnalysisData>(`analyses/${id}`);
    if (analysis.attributes?.status === 'completed') return analysis;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new ExternalServiceError('virustotal', 'A análise excedeu o tempo limite.', {
    code: 'ANALYSIS_TIMEOUT',
    retryable: true,
  });
};
