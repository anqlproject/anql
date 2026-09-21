import './ChartSelect.css';

import { Check, ChevronDown } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export interface ChartSelectOption {
  value: string;
  label: string;
  color?: string;
  disabled?: boolean;
}

export function ChartSelectOptionContent({
  label,
  color,
  selected,
}: {
  label: string;
  color?: string;
  selected?: boolean;
}) {
  return (
    <>
      <span className="chart-custom-select-item-label">
        {color && <span className="chart-select-swatch" style={{ backgroundColor: color }} />}
        {label}
      </span>
      {selected && <Check size={14} className="chart-custom-select-check" />}
    </>
  );
}

export function ChartSelectOptionItem({
  option,
  selected,
  keepOpen = false,
  onSelect,
}: {
  option: ChartSelectOption;
  selected: boolean;
  keepOpen?: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <DropdownMenuItem
      disabled={option.disabled}
      onSelect={event => {
        if (keepOpen) event.preventDefault();
        onSelect(option.value);
      }}
      className={`chart-custom-select-item${selected ? ' is-selected' : ''}`}
    >
      <ChartSelectOptionContent label={option.label} color={option.color} selected={selected} />
    </DropdownMenuItem>
  );
}

export function ChartSelect({ 
  value, 
  options, 
  onChange, 
  ariaLabel 
}: { 
  value: string; 
  options: ChartSelectOption[]; 
  onChange: (val: string) => void; 
  ariaLabel?: string 
}) {
  const selectedOption = options.find(o => o.value === value) || options[0];
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="chart-custom-select" aria-label={ariaLabel}>
          <span className="chart-custom-select-label">
            {selectedOption?.color && <span className="chart-select-swatch" style={{ backgroundColor: selectedOption.color }} />}
            {selectedOption?.label || value}
          </span>
          <ChevronDown size={14} className="chart-custom-select-icon" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="chart-custom-select-content">
        {options.map(option => (
          <ChartSelectOptionItem
            key={option.value}
            option={option}
            selected={option.value === value}
            onSelect={onChange}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
