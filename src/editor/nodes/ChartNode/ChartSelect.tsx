import { Check, ChevronDown } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export interface ChartSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
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
          <span className="chart-custom-select-label">{selectedOption?.label || value}</span>
          <ChevronDown size={14} className="chart-custom-select-icon" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="chart-custom-select-content">
        {options.map(option => (
          <DropdownMenuItem 
            key={option.value} 
            disabled={option.disabled} 
            onClick={() => onChange(option.value)}
            className={`chart-custom-select-item ${option.value === value ? 'is-selected' : ''}`}
          >
            {option.label}
            {option.value === value && <Check size={14} className="chart-custom-select-check" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
