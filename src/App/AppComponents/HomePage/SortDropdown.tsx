import './SortDropdown.css';

import { ArrowDown,ArrowUp, ArrowUpDown } from 'lucide-react';
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
      return direction === 'asc' ? <ArrowUp className="sort-dropdown__icon" /> : <ArrowDown className="sort-dropdown__icon" />;
    }
    return null;
  };

  const isCurrentSort = (field: SortField, direction: SortDirection) => {
    return currentSort.field === field && currentSort.direction === direction;
  };

  const getCurrentSortLabel = () => {
    switch (currentSort.field) {
      case 'title':
        return currentSort.direction === 'asc' ? t('HOME_PAGE.nameAsc') as string : t('HOME_PAGE.nameDesc') as string;
      case 'created_at':
        return currentSort.direction === 'asc' ? t('HOME_PAGE.creationAsc') as string : t('HOME_PAGE.creationDesc') as string;
      case 'updated_at':
        return currentSort.direction === 'asc' ? t('HOME_PAGE.modificationAsc') as string : t('HOME_PAGE.modificationDesc') as string;
      default:
        return t('HOME_PAGE.sort') as string;
    }
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
          {getSortIcon('created_at', 'asc')}
          {t('HOME_PAGE.oldestToNewest')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSortChange({ field: 'created_at', direction: 'desc' })}
          className={`sort-dropdown__item ${isCurrentSort('created_at', 'desc') ? 'sort-dropdown__item--selected' : ''}`}
        >
          {getSortIcon('created_at', 'desc')}
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
