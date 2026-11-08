import { useEffect } from 'react';

import { preloadShikiResources } from '@/editor/plugins/CodeHighlightShikiPlugin';

export function ShikiInitializer() {
  useEffect(() => {
    preloadShikiResources().catch((error: unknown) => {
      console.error('Failed to preload Shiki resources:', error);
    });
  }, []);

  return null;
}
