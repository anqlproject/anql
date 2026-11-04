import { createState } from 'lexical';

export const codeReferenceIdState = createState('referenceId', {
  parse: (value) => typeof value === 'string' ? value : undefined,
});

export const codeReferenceValueVersionState = createState('referenceValueVersion', {
  parse: (value) => typeof value === 'string' ? value : undefined,
});

export function getReferenceValueVersion(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * prime) & mask;
  }

  return `${value.length}:${hash.toString(16)}`;
}
