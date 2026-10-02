import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Mic } from 'lucide-react';
import type { OverlayState } from '@shared/domain/system';
import { api } from '@renderer/lib/api';
import { cn } from '@renderer/lib/cn';
import { Chip, iconButtonClass } from './pill-parts';
import {
  panelClass,
  panelItemClass,
  panelSelectedClass,
  PanelCheck,
  PanelHint,
  PanelLabel,
  PanelSeparator,
  PanelTail,
} from './panel';

/** Panels are capped so they fit the height the main process grants, and scroll past it. */
const listClass = 'max-h-[160px] overflow-y-auto overscroll-contain';

/** Frame 9: pick the microphone without leaving whatever is being dictated into. */
export function DevicePicker({
  state,
  open,
  onOpenChange,
}: {
  state: OverlayState;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const recording = state.phase === 'listening';

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Popover.Trigger
        aria-label="Choose microphone"
        className={cn(iconButtonClass, open && 'bg-accent-soft text-accent')}
      >
        <Mic className="size-[15px]" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={state.anchor === 'top' ? 'bottom' : 'top'}
          align="start"
          sideOffset={8}
          collisionPadding={0}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn(panelClass, 'min-w-[232px]')}
        >
          <PanelLabel>Microphone</PanelLabel>
          <div className={listClass}>
            {state.devices.length === 0 && <PanelHint>No microphones were found.</PanelHint>}
            {state.devices.map((device) => {
              const selected = device.id === state.deviceId;
              return (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => {
                    void api.overlay.act({ type: 'select-microphone', id: device.id });
                    onOpenChange(false);
                  }}
                  className={cn(
                    panelItemClass,
                    'w-full hover:bg-sunken',
                    selected && `${panelSelectedClass} hover:bg-accent-soft`,
                  )}
                >
                  <PanelCheck selected={selected} />
                  <span className="truncate">{device.label}</span>
                </button>
              );
            })}
          </div>
          {recording && (
            <>
              <PanelSeparator />
              <PanelHint>Switching restarts the recording.</PanelHint>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Frame 10: swap the recognition model, offered from what is actually installed. */
export function ModelPicker({
  state,
  open,
  onOpenChange,
}: {
  state: OverlayState;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Choose recognition model"
          className="flex min-w-0 shrink cursor-default items-center outline-none"
        >
          <Chip
            title={state.model}
            className={cn('gap-1 pr-1.5', open && 'bg-accent-soft text-accent')}
          >
            {state.model}
            <ChevronDown aria-hidden className="ml-1 size-3 shrink-0" />
          </Chip>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={state.anchor === 'top' ? 'bottom' : 'top'}
          align="end"
          sideOffset={8}
          collisionPadding={0}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn(panelClass, 'min-w-[244px]')}
        >
          <PanelLabel>Recognition model</PanelLabel>
          <div className={listClass}>
            {state.models.map((model) => {
              const selected = model.id === state.modelId;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    void api.overlay.act({ type: 'select-model', id: model.id });
                    onOpenChange(false);
                  }}
                  className={cn(
                    panelItemClass,
                    'w-full hover:bg-sunken',
                    selected && `${panelSelectedClass} hover:bg-accent-soft`,
                  )}
                >
                  <PanelCheck selected={selected} />
                  <span className="truncate">{model.label}</span>
                  {selected && <PanelTail>active</PanelTail>}
                </button>
              );
            })}
          </div>
          <PanelSeparator />
          <PanelHint>Models that are not installed are not shown.</PanelHint>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
