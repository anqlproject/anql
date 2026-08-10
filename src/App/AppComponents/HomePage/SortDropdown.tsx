import './SortDropdown.css';

import { ArrowDownAZ, ArrowDownZA, ArrowUpDown,ClockArrowDown, ClockArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SortField = 'title' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

interface SortOption {
  field: SortField;
  direction: SortDirection;
}

interface SortDropdownProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export default function SortDropdown({ currentSort, onSortChange }: SortDropdownProps) {
  const { t } = useTranslation();
  const getSortIcon = (field: SortField, direction: SortDirection) => {
    if (currentSort.field === field) {
      if (field === 'title') {
        return direction === 'asc' ? <ArrowDownAZ className="sort-dropdown__icon" /> : <ArrowDownZA className="sort-dropdown__icon" />;
      } else {
        return direction === 'asc' ? <ClockArrowUp className="sort-dropdown__icon" /> : <ClockArrowDown className="sort-dropdown__icon" />;
      }
    }
    return null;
  };

  const isCurrentSort = (field: SortField, direction: SortDirection) => {
    return currentSort.field === field && currentSort.direction === direction;
  };

  const getCurrentSortLabel = () => {
    let icon;
    let label;
    switch (currentSort.field) {
      case 'title':
        icon = currentSort.direction === 'asc' ? <ArrowDownAZ className="sort-dropdown__icon" /> : <ArrowDownZA className="sort-dropdown__icon" />;
        label = t('HOME_PAGE.sortByName');
        break;
      case 'created_at':
        icon = currentSort.direction === 'asc' ? <ClockArrowUp className="sort-dropdown__icon" /> : <ClockArrowDown className="sort-dropdown__icon" />;
        label = t('HOME_PAGE.sortByCreation');
        break;
      case 'updated_at':
        icon = currentSort.direction === 'asc' ? <ClockArrowUp className="sort-dropdown__icon" /> : <ClockArrowDown className="sort-dropdown__icon" />;
        label = t('HOME_PAGE.sortByModification');
        break;
      default:
        icon = currentSort.direction === 'asc' ? <ClockArrowUp className="sort-dropdown__icon" /> : <ClockArrowDown className="sort-dropdown__icon" />;
        label = t('HOME_PAGE.sort');
    }
    return <>{label} {icon}</>;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="sortButton">
          <ArrowUpDown className="sortIcon" />
          {getCurrentSortLabel()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="sortDropdown" onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="sort-dropdown__header">
          {t('HOME_PAGE.sortByName')}
        </div>
        <DropdownMenuItem
          onClick={() => onSortChange({ field: 'title', direction: 'asc' })}
          className={`sort-dropdown__item ${isCurrentSort('title', 'asc') ? 'sort-dropdown__item--selected' : ''}`}
        >
          {getSortIcon('title', 'asc')}
          {t('HOME_PAGE.nameAsc')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSortChange({ field: 'title', direction: 'desc' })}
          className={`sort-dropdown__item ${isCurrentSort('title', 'desc') ? 'sort-dropdown__item--selected' : ''}`}
        >
          {getSortIcon('title', 'desc')}
          {t('HOME_PAGE.nameDesc')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="sort-dropdown__header">
          {t('HOME_PAGE.sortByCreation')}
        </div>
        <DropdownMenuItem
          onClick={() => onSortChange({ field: 'created_at', direction: 'asc' })}
          className={`sort-dropdown__item ${isCurrentSort('created_at', 'asc') ? 'sort-dropdown__item--selected' : ''}`}
        >
          {t('HOME_PAGE.oldestToNewest')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSortChange({ field: 'created_at', direction: 'desc' })}
          className={`sort-dropdown__item ${isCurrentSort('created_at', 'desc') ? 'sort-dropdown__item--selected' : ''}`}
        >
          {t('HOME_PAGE.newestToOldest')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="sort-dropdown__header">
          {t('HOME_PAGE.sortByModification')}
        </div>
        <DropdownMenuItem
          onClick={() => onSortChange({ field: 'updated_at', direction: 'asc' })}
          className={`sort-dropdown__item ${isCurrentSort('updated_at', 'asc') ? 'sort-dropdown__item--selected' : ''}`}
        >
          {getSortIcon('updated_at', 'asc')}
          {t('HOME_PAGE.oldestToNewest')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSortChange({ field: 'updated_at', direction: 'desc' })}
          className={`sort-dropdown__item ${isCurrentSort('updated_at', 'desc') ? 'sort-dropdown__item--selected' : ''}`}
        >
          {getSortIcon('updated_at', 'desc')}
          {t('HOME_PAGE.newestToOldest')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
