import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { z } from 'zod';
import type { IpcChannel } from '@shared/ipc/channels';
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
