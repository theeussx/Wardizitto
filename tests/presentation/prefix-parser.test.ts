import { describe, expect, it } from 'vitest';

import { parseArguments } from '../../src/presentation/discord/handlers/prefix-command-handler.js';

describe('parseArguments', () => {
  it('interpreta espaços, aspas e escapes', () => {
    expect(parseArguments('say "hello world" test\\ value')).toEqual([
      'say',
      'hello world',
      'test value',
    ]);
  });

  it('aceita entrada vazia e barra final', () => {
    expect(parseArguments('   ')).toEqual([]);
    expect(parseArguments('command value\\')).toEqual(['command', 'value\\']);
  });
});
