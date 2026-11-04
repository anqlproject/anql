import { createState } from 'lexical';

export const codeReferenceIdState = createState('referenceId', {
  parse: (value) => typeof value === 'string' ? value : undefined,
});

export const codeReferenceUpdatedAtState = createState('referenceUpdatedAt', {
  parse: (value) => typeof value === 'number' ? value : undefined,
});
