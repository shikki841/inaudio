import { forwardRef } from 'react';
import { Button, type ButtonProps } from './button';
import { Tooltip } from './tooltip';

/** Icon-only button. `label` is both the accessible name and the tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string; side?: 'top' | 'right' | 'bottom' | 'left' }>(
  ({ label, side, variant = 'ghost', size = 'icon', ...props }, ref) => (
    <Tooltip content={label} side={side}>
      <Button ref={ref} variant={variant} size={size} aria-label={label} {...props} />
    </Tooltip>
  ),
);
IconButton.displayName = 'IconButton';
