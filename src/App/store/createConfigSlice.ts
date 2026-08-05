import { StateCreator } from 'zustand';

import { DEFAULT_SETTINGS } from '@/core/global/defaultSettings';

/** Typed application configuration, mirrors DEFAULT_SETTINGS shape */
export type AppConfig = typeof DEFAULT_SETTINGS;

export interface ConfigSlice {
  /** Full typed config, initialized to DEFAULT_SETTINGS */
  config: AppConfig;
  /** Replace the entire config */
  setConfig: (config: AppConfig) => void;
  /** Deep-merge a partial patch into the current config */
  patchConfig: <K extends keyof AppConfig>(category: K, values: Partial<AppConfig[K]>) => void;
}

export const createConfigSlice: StateCreator<ConfigSlice> = (set) => ({
  config: DEFAULT_SETTINGS,

  setConfig: (config) => set({ config }),

  patchConfig: (category, values) =>
    set((state) => ({
      config: {
        ...state.config,
        [category]: {
          ...(state.config[category] as object),
          ...values,
        },
      },
    })),
});
