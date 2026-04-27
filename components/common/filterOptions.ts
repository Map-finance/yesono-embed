import { TranslationKeys } from '@/lib/i18n/translations';

export type FilterOption = { value: string; label: string };

// UI-facing option lists — values are stable keys (used in logic), labels come from translations
export const getHolderFilterOptions = (t: TranslationKeys): FilterOption[] => [
  { value: 'all', label: t.market.holderFilters.all },
  { value: 'decrease50', label: t.market.holderFilters.decrease50 },
  { value: 'increase25', label: t.market.holderFilters.increase25 },
  { value: 'noChange', label: t.market.holderFilters.noChange },
  { value: 'decrease25', label: t.market.holderFilters.decrease25 },
];

export const getActivityFilterOptions = (t: TranslationKeys): FilterOption[] => [
  { value: 'all', label: t.common.all },
  { value: 'buys', label: t.market.activityFilters.buys },
  { value: 'sells', label: t.market.activityFilters.sells },
];

export const getMinAmountOptions = (t: TranslationKeys): FilterOption[] => [
  { value: 'min', label: t.common.minAmount },
  { value: '10', label: '$10+' },
  { value: '100', label: '$100+' },
  { value: '1k', label: '$1,000+' },
  { value: '10k', label: '$10,000+' },
];

export const labelFor = (options: FilterOption[], value: string) => {
  return options.find((o) => o.value === value)?.label || value;
};
