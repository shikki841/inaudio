import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@renderer/lib/cn';

export interface SelectOption<T extends string> {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
  adornment?: ReactNode;
  disabled?: boolean;
}

export function Select<T extends string>({
  value,
  onValueChange,
  options,
  label,
  placeholder,
  className,
  disabled,
}: {
  value: T | undefined;
  onValueChange(value: T): void;
  options: SelectOption<T>[];
  label: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onValueChange(v as T)} disabled={disabled}>
      <SelectPrimitive.Trigger
        aria-label={label}
        className={cn(
          'inline-flex h-9 min-w-48 items-center justify-between gap-2 rounded-[6px] bg-sunken px-3 text-sm text-ink hover:bg-line disabled:opacity-50',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {options.find((option) => option.value === value)?.adornment}
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-80 min-w-(--radix-select-trigger-width) overflow-hidden rounded-[12px] border border-line bg-surface p-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex cursor-default items-center gap-2 rounded-[6px] py-2 pr-3 pl-8 text-sm outline-none data-disabled:opacity-40 data-highlighted:bg-sunken"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2.5">
                  <Check className="size-4 text-accent" />
                </SelectPrimitive.ItemIndicator>
                {option.adornment}
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                {option.hint && <span className="ml-auto pl-4 text-xs text-faint">{option.hint}</span>}
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
