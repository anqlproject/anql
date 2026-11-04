import { createState } from 'lexical';

export const codeReferenceIdState = createState('referenceId', {
  parse: (value) => typeof value === 'string' ? value : undefined,
});
