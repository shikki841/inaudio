import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { z } from 'zod';
import type { IpcChannel } from '@shared/ipc/channels';
import { assertSurface, type Surface } from '../security/surfaces';
import { assertTrustedSender } from '../security/trusted-origin';

/** Registers an invoke handler that checks the sender and validates input before running. */
export function handle<S extends z.ZodType, R>(
  channel: IpcChannel,
  schema: S,
  fn: (input: z.output<S>, event: IpcMainInvokeEvent) => R | Promise<R>,
): void {
  ipcMain.handle(channel, async (event, raw: unknown) => {
    assertTrustedSender(event);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new Error(`Invalid payload for ${channel}`);
    return fn(parsed.data, event);
  });
}

/** Like handle, but the call must come from one named window and no other. */
export function handleOn<S extends z.ZodType, R>(
  surface: Surface,
  channel: IpcChannel,
  schema: S,
  fn: (input: z.output<S>, event: IpcMainInvokeEvent) => R | Promise<R>,
): void {
  ipcMain.handle(channel, async (event, raw: unknown) => {
    assertSurface(event, surface);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new Error(`Invalid payload for ${channel}`);
    return fn(parsed.data, event);
  });
}

/**
 * A fire-and-forget message from one named window. The sender gets no reply, so an
 * untrusted sender or a malformed payload is dropped rather than thrown back.
 */
export function listen<S extends z.ZodType>(
  surface: Surface,
  channel: IpcChannel,
  schema: S,
  fn: (input: z.output<S>) => void,
): void {
  ipcMain.on(channel, (event, raw: unknown) => {
    try {
      assertSurface(event, surface);
    } catch {
      return;
    }
    const parsed = schema.safeParse(raw);
    if (parsed.success) fn(parsed.data);
  });
}
