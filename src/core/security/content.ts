import { ValidationError } from '../errors/app-error.js';

export const requireHttpUrl = (value: string, field = 'URL'): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new ValidationError(`${field} inválida.`, { cause: error });
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ValidationError(`${field} deve usar HTTP ou HTTPS.`);
  }
  if (url.username !== '' || url.password !== '') {
    throw new ValidationError(`${field} não pode conter credenciais.`);
  }
  return url;
};

export const truncateUserContent = (value: string, maxLength: number): string => {
  const normalized = value.replaceAll('\u0000', '').trim();
  if (normalized.length === 0) throw new ValidationError('O conteúdo não pode estar vazio.');
  return normalized.slice(0, maxLength);
};
