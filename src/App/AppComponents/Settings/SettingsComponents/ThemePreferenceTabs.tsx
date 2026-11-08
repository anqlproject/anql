import './ThemePreferenceTabs.css';

import { motion, useReducedMotion } from 'framer-motion';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemePreferenceTabsProps {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
}

const themeOptions = [
  { value: 'system', icon: Monitor, label: 'SETTINGS.appearance.system' },
  { value: 'light', icon: Sun, label: 'SETTINGS.appearance.light' },
  { value: 'dark', icon: Moon, label: 'SETTINGS.appearance.dark' },
] as const;

export default function ThemePreferenceTabs({ value, onChange }: ThemePreferenceTabsProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className="theme-preference-tabs"
      role="tablist"
      aria-label={t('SETTINGS.appearance.theme') as string}
    >
      {themeOptions.map(({ value: option, icon: Icon, label }) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={value === option}
          aria-label={t(label) as string}
          title={t(label) as string}
          className={`theme-preference-tab${value === option ? ' is-active' : ''}`}
          onClick={() => onChange(option)}
        >
          {value === option && (
            <motion.span
              aria-hidden="true"
              className="theme-preference-tab__indicator"
              layoutId="theme-preference-tab-indicator"
              transition={prefersReducedMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 500, damping: 36 }}
            />
          )}
          <span className="theme-preference-tab__content">
            <Icon size={15} aria-hidden="true" />
          </span>
        </button>
      ))}
    </div>
  );
}