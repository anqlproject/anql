import './SettingsSelect.css';

import { Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface SettingsSelectOption {
  value: string;
  label: string;
}

interface SettingsSelectProps {
  value: string;
  options: SettingsSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
}

export default function SettingsSelect({
  value,
  options,
  onChange,
  ariaLabel,
}: SettingsSelectProps) {
  const { t } = useTranslation();
  const selectedOption = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="settings-select-trigger"
          aria-label={ariaLabel}
        >
          <span className="settings-select-value">
            {selectedOption ? t(selectedOption.label) as string : value}
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="settings-select-menu">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="settings-select-option"
            role="menuitemradio"
            aria-checked={option.value === value}
            onSelect={() => onChange(option.value)}
          >
            <span className="settings-select-option-indicator" aria-hidden="true">
              {option.value === value && <Check size={14} />}
            </span>
            <span>{t(option.label) as string}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}