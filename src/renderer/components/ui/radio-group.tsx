import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import type { ReactNode } from 'react';
import { cn } from '@renderer/lib/cn';

export function RadioGroup<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T;
  onValueChange(value: T): void;
  options: { value: T; label: ReactNode; description?: ReactNode; disabled?: boolean }[];
  label: string;
  className?: string;
}) {
  return (
    <RadioGroupPrimitive.Root
      aria-label={label}
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn('grid gap-1', className)}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-sunken',
            option.disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <RadioGroupPrimitive.Item
            value={option.value}
            disabled={option.disabled}
            className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 border-line-strong data-[state=checked]:border-accent"
          >
            <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-accent" />
          </RadioGroupPrimitive.Item>
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">{option.label}</span>
            {option.description && <span className="text-[13px] text-muted">{option.description}</span>}
          </span>
        </label>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
