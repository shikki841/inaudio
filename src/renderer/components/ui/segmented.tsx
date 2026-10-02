import * as ToggleGroup from '@radix-ui/react-toggle-group';
import type { ReactNode } from 'react';
import { cn } from '@renderer/lib/cn';

/** Single-choice toggle group rendered as a segmented control. */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  disabled,
}: {
  value: T;
  onValueChange(value: T): void;
  options: { value: T; label: ReactNode }[];
  label: string;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      disabled={disabled}
      onValueChange={(v) => v && onValueChange(v as T)}
      className={cn('inline-flex rounded-[6px] bg-sunken p-0.5', disabled && 'opacity-50')}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            'h-8 rounded-[6px] px-3 text-sm font-medium text-muted hover:text-ink',
            'data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-[0_0_0_1px_var(--line)]',
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
