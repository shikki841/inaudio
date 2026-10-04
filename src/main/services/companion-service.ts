import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import {
  BUILT_IN_COMPANIONS,
  companionSettingsSchema,
  type CompanionEvent,
  type CompanionPackage,
  type CompanionSettings,
  type CompanionState,
} from '@shared/domain/companion';
import type { Settings, SettingsPatch } from '@shared/domain/settings';
import type { AppPaths } from '../app/paths';
import { readCompanionManifest } from './companion-package';
import { createCompanionWindow, placeCompanion } from '../windows/companion-window';
import type { SettingsStore } from './settings-store';

export interface CompanionSnapshot {
  companion: CompanionPackage;
  settings: CompanionSettings;
  state: CompanionState;
}

export class CompanionService extends EventEmitter<{
  changed: [CompanionSnapshot];
  event: [CompanionEvent];
}> {
  private window: BrowserWindow | null = null;
  private state: CompanionState = 'idle';
  private packages: CompanionPackage[] = [...BUILT_IN_COMPANIONS];
  private sleepingTimer: NodeJS.Timeout | null = null;
  private focusTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly paths: AppPaths,
    private readonly settings: SettingsStore,
  ) {
    super();
    this.discover();
    this.settings.on('change', (next) => this.onSettings(next));
  }

  list(): CompanionPackage[] {
    return this.packages;
  }

  snapshot(): CompanionSnapshot {
    const settings = this.settings.get().companion;
    const companion = this.packages.find((item) => item.id === settings.activeId) ?? this.packages[0];
    if (!companion) throw new Error('No companion is installed');
    return { companion, settings, state: this.state };
  }

  select(id: string): CompanionSnapshot {
    if (!this.packages.some((item) => item.id === id)) throw new Error('Unknown companion');
    this.settings.update({ companion: { activeId: id } });
    return this.snapshot();
  }

  update(patch: SettingsPatch['companion']): CompanionSnapshot {
    const next = companionSettingsSchema.parse({ ...this.settings.get().companion, ...patch });
    if (!this.packages.some((item) => item.id === next.activeId)) throw new Error('Unknown companion');
    this.settings.update({ companion: next });
    return this.snapshot();
  }

  setWindow(win: BrowserWindow): void {
    this.window = win;
    win.on('closed', () => {
      if (this.window === win) this.window = null;
    });
    this.applyWindow();
    this.syncFocusTracking();
    this.emitChanged();
  }

  show(): void {
    const win = this.ensureWindow();
    this.settings.update({ companion: { visible: true } });
    win.showInactive();
  }

  hide(): void {
    this.settings.update({ companion: { visible: false } });
    this.window?.hide();
  }

  toggleClickThrough(): void {
    const next = !this.settings.get().companion.clickThrough;
    this.update({ clickThrough: next });
    this.window?.setIgnoreMouseEvents(next, { forward: true });
  }

  react(event: CompanionEvent, state: CompanionState): void {
    const reaction = this.settings.get().companion.reactions[event];
    if (!reaction?.enabled) return;
    this.state = reaction.state === 'ready' ? state : reaction.state;
    this.resetSleepTimer();
    this.emit('event', event);
    this.emitChanged();
  }

  dispose(): void {
    if (this.sleepingTimer) clearTimeout(this.sleepingTimer);
    if (this.focusTimer) clearInterval(this.focusTimer);
    this.sleepingTimer = null;
    this.focusTimer = null;
    this.window?.close();
    this.window = null;
  }

  private ensureWindow(): BrowserWindow {
    if (!this.window || this.window.isDestroyed()) {
      this.setWindow(createCompanionWindow());
    }
    if (!this.window) throw new Error('Could not create companion window');
    return this.window;
  }

  private onSettings(next: Settings): void {
    this.applyWindow(next);
    this.emitChanged();
  }

  private applyWindow(settings = this.settings.get()): void {
    const win = this.window;
    if (!win || win.isDestroyed()) return;
    const companion = settings.companion;
    placeCompanion(win, companion.position, companion.scale, companion);
    win.setIgnoreMouseEvents(companion.clickThrough, { forward: true });
    if (companion.visible) win.showInactive();
    else win.hide();
    this.syncFocusTracking(settings);
  }

  private syncFocusTracking(settings = this.settings.get()): void {
    if (this.focusTimer) clearInterval(this.focusTimer);
    this.focusTimer = null;
    if (settings.companion.position !== 'focus-area') return;
    this.focusTimer = setInterval(() => {
      if (this.window && !this.window.isDestroyed()) {
        const companion = this.settings.get().companion;
        placeCompanion(this.window, 'focus-area', companion.scale, companion);
      }
    }, 250);
    this.focusTimer.unref();
  }

  private emitChanged(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('event:companion-state', this.snapshot());
    }
    this.emit('changed', this.snapshot());
  }

  private resetSleepTimer(): void {
    if (this.sleepingTimer) clearTimeout(this.sleepingTimer);
    this.sleepingTimer = setTimeout(() => {
      this.state = 'sleeping';
      this.emitChanged();
    }, this.settings.get().companion.idleSleepMinutes * 60_000);
    this.sleepingTimer.unref();
  }

  private discover(): void {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(this.paths.companions, { withFileTypes: true });
    } catch (error) {
      console.error('Could not discover companions', error);
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const directory = path.join(this.paths.companions, entry.name);
        const { manifest } = readCompanionManifest(directory);
        if (!this.packages.some((item) => item.id === manifest.id)) this.packages.push(manifest);
      } catch (error) {
        console.warn(`Skipping invalid companion ${entry.name}`, error);
      }
    }
  }
}
