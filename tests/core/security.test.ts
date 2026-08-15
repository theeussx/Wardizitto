import { describe, expect, it } from 'vitest';

import { requireHttpUrl, truncateUserContent } from '../../src/core/security/content.js';
import { configurePrivilegedUsers, isDeveloper, isOwner } from '../../src/core/security/owner.js';
import { isPrivateAddress } from '../../src/infrastructure/http/safe-http-client.js';

describe('segurança de conteúdo', () => {
  it('aceita somente URLs HTTP(S) sem credenciais', () => {
    expect(requireHttpUrl('https://example.com/path').hostname).toBe('example.com');
    expect(() => requireHttpUrl('not a url')).toThrow('inválida');
    expect(() => requireHttpUrl('file:///etc/passwd')).toThrow('HTTP');
    expect(() => requireHttpUrl('https://user:pass@example.com')).toThrow('credenciais');
  });

  it('normaliza e limita conteúdo do usuário', () => {
    expect(truncateUserContent('  hello\u0000 world  ', 5)).toBe('hello');
    expect(() => truncateUserContent('   ', 10)).toThrow('vazio');
  });
});

describe('rede e identidades privilegiadas', () => {
  it.each(['127.0.0.1', '10.0.0.1', '192.168.1.1', '::1', 'fd00::1'])('%s é privado', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it('distingue endereços públicos e identificadores inválidos', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('not-an-ip')).toBe(true);
  });

  it('centraliza owners e developers', () => {
    expect(() => configurePrivilegedUsers([], [])).toThrow('owner');
    configurePrivilegedUsers(['100'], ['200']);
    expect(isOwner('100')).toBe(true);
    expect(isDeveloper('100')).toBe(true);
    expect(isDeveloper('200')).toBe(true);
    expect(isOwner('200')).toBe(false);
  });
});
