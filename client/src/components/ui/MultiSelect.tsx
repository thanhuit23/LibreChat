import React, { useRef } from 'react';
import {
  Select,
  SelectArrow,
  SelectItem,
  SelectItemCheck,
  SelectLabel,
  SelectPopover,
  SelectProvider,
} from '@ariakit/react';
import { useGetMCP } from '~/data-provider';

import { cn } from '~/utils';

interface MultiSelectProps<T extends string> {
  items: T[];
  label?: string;
  placeholder?: string;
  defaultSelectedValues?: T[];
  onSelectedValuesChange?: (values: T[]) => void;
  renderSelectedValues?: (values: T[], placeholder?: string) => React.ReactNode;
  className?: string;
  itemClassName?: string;
  labelClassName?: string;
  selectClassName?: string;
  selectIcon?: React.ReactNode;
  popoverClassName?: string;
  selectItemsClassName?: string;
  selectedValues: T[];
  setSelectedValues: (values: T[]) => void;
}

function defaultRender<T extends string>(values: T[], placeholder?: string) {
  if (values.length === 0) {
    return placeholder || 'Select...';
  }
  if (values.length === 1) {
    return values[0];
  }
  return `${values.length} items selected`;
}

const loadingMCPServers: { name: string; isDefault: boolean }[] = [
  {
    name: 'time',
    isDefault: true,
  },
];

export default function MultiSelect<T extends string>({
  items,
  label,
  placeholder = 'Select...',
  defaultSelectedValues = [],
  onSelectedValuesChange,
  renderSelectedValues = defaultRender,
  className,
  selectIcon,
  itemClassName,
  labelClassName,
  selectClassName,
  popoverClassName,
  selectItemsClassName,
  selectedValues = [],
  setSelectedValues,
}: MultiSelectProps<T>) {
  const selectRef = useRef<HTMLButtonElement>(null);
  // const [selectedValues, setSelectedValues] = React.useState<T[]>(defaultSelectedValues);

  // const { data: startupConfig } = useGetStartupConfig();

  const { data: mcpServers = loadingMCPServers } = useGetMCP({
    select: (data) =>
      data.map((mcpServer) => ({
        name: mcpServer.name,
        isDefault: Boolean(mcpServer.isDefault), // Ensure boolean type
      })),
  });

  // Extract default server names from mcpServers where isDefault = true
  const defaultMCPServers = mcpServers
    .filter(server => server.isDefault)
    .map(server => server.name);

  // Use defaultMCPServers with fallback if empty
  const serverNamesForFiltering = defaultMCPServers.length > 0 ? defaultMCPServers : ['time'];

  const filteredSelectedValues = selectedValues.filter(
    (value) => !serverNamesForFiltering.includes(value)
  );

  if (filteredSelectedValues.length === 0) {
    return null;
  }

  const handleValueChange = (values: T[]) => {
    setSelectedValues(values);
    if (onSelectedValuesChange) {
      onSelectedValuesChange(values);
    }
  };

  return (
    <div className={className}>
      <SelectProvider value={filteredSelectedValues} setValue={handleValueChange}>
        {label && (
          <SelectLabel className={cn('mb-1 block text-sm text-text-primary', labelClassName)}>
            {label}
          </SelectLabel>
        )}
        <Select
          ref={selectRef}
          className={cn(
            'flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm',
            'bg-surface-tertiary text-text-primary shadow-sm hover:cursor-pointer hover:bg-surface-hover',
            'outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75',
            selectClassName,
            filteredSelectedValues.length > 0 && selectItemsClassName != null && selectItemsClassName,
          )}
          onChange={(e) => e.stopPropagation()}
        >
          {selectIcon && selectIcon}
          <span className="mr-auto hidden truncate md:block">
            {renderSelectedValues(filteredSelectedValues, placeholder)}
          </span>
          <SelectArrow className="ml-1 hidden stroke-1 text-base opacity-75 md:block" />
        </Select>
        <SelectPopover
          gutter={4}
          sameWidth
          modal
          unmountOnHide
          finalFocus={selectRef}
          className={cn(
            'animate-popover z-50 flex max-h-[300px]',
            'flex-col overflow-auto overscroll-contain rounded-xl',
            'bg-surface-secondary px-1.5 py-1 text-text-primary shadow-lg',
            'border border-border-light',
            'outline-none',
            popoverClassName,
          )}
        >
          {items.map((value) => (
            <SelectItem
              key={value}
              value={value}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-1.5 hover:cursor-pointer',
                'scroll-m-1 outline-none transition-colors',
                'hover:bg-black/[0.075] dark:hover:bg-white/10',
                'data-[active-item]:bg-black/[0.075] dark:data-[active-item]:bg-white/10',
                'w-full min-w-0 text-sm',
                itemClassName,
              )}
            >
              <SelectItemCheck className="text-primary" />
              <span className="truncate">{value}</span>
            </SelectItem>
          ))}
        </SelectPopover>
      </SelectProvider>
    </div>
  );
}