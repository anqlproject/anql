import { useEffect } from 'react';

import { useShortcutStore } from '@/GlobalState/shortcutStore';

export default function GlobalShortcutListener() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Let the shortcut store handle the event (context is calculated on the fly)
      useShortcutStore.getState().handleKeyDown(event);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return null;
}
