import { useEffect } from 'react';

import { GLOBAL_SHORTCUTS, useShortcutStore } from '@/GlobalState/shortcutStore';

import { useGlobalShortcut } from './GlobalShortcutContext';

export default function GlobalShortcut() {
  const { openLocalSearch, openGlobalSearch, createNewDocument, exitApp } = useGlobalShortcut();

  useEffect(() => {
    // Register global shortcuts with the central store
    const registerShortcut = useShortcutStore.getState().registerShortcut;
    const registerCallback = useShortcutStore.getState().registerCallback;

    // Register shortcut definitions
    Object.entries(GLOBAL_SHORTCUTS).forEach(([id, definition]) => {
      registerShortcut(id, definition);
    });

    // Register callbacks
    registerCallback('LOCAL_SEARCH', () => openLocalSearch());
    registerCallback('GLOBAL_SEARCH', () => openGlobalSearch());
    registerCallback('NEW_DOCUMENT', () => createNewDocument());
    registerCallback('EXIT_APP', () => exitApp());

    // Cleanup function
    return () => {
      const unregisterCallback = useShortcutStore.getState().unregisterCallback;
      Object.keys(GLOBAL_SHORTCUTS).forEach(id => {
        unregisterCallback(id);
      });
    };
  }, [openLocalSearch, openGlobalSearch, createNewDocument, exitApp]);

  return null;
}
