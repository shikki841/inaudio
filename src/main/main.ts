import { app, BrowserWindow, Menu, nativeTheme, powerMonitor, systemPreferences } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import type { AppCommand } from '@shared/domain/system';
import { EVENTS } from '@shared/ipc/channels';
import { appPaths } from './app/paths';
import { registerIpc } from './ipc/register';
import { handleAppScheme, registerAppScheme } from './security/app-protocol';
import { applySessionPolicy } from './security/hardening';
import { createServices, type Services } from './services/container';
import { ShortcutService } from './services/shortcuts';
import { TrayService } from './services/tray';
import { createMainWindow } from './windows/main-window';

if (started) app.quit();

app.setName('Inaudio');
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  registerAppScheme();
  app.enableSandbox();
  bootstrap();
}

function bootstrap(): void {
  let mainWindow: BrowserWindow | null = null;
  let services: Services | null = null;
  let quitting = false;

  const send = (channel: string, payload?: unknown) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
  };
  const command = (value: AppCommand) => send(EVENTS.command, value);

  const showWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = openWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  };

  const tray = new TrayService({
    show: showWindow,
    toggleDictation: () => command('dictation:toggle'),
    readClipboard: () => command('read-aloud:clipboard'),
    openSettings: () => {
      showWindow();
      command('navigate:settings');
    },
    quit: () => {
      quitting = true;
      app.quit();
    },
  });

  const shortcuts = new ShortcutService({
    dictation: () => command('dictation:toggle'),
    readAloud: () => command('read-aloud:clipboard'),
  });

  function openWindow(): BrowserWindow {
    const win = createMainWindow();
    win.on('close', (event) => {
      if (!quitting && services?.settings.get().system.closeToTray) {
        event.preventDefault();
        win.hide();
      }
    });
    win.on('closed', () => {
      if (mainWindow === win) mainWindow = null;
    });
    const emitWindowStatus = () => send(EVENTS.statusChanged);
    win.on('maximize', emitWindowStatus);
    win.on('unmaximize', emitWindowStatus);
    win.on('minimize', emitWindowStatus);
    win.on('restore', emitWindowStatus);
    win.on('focus', emitWindowStatus);
    win.on('blur', emitWindowStatus);
    win.on('enter-full-screen', emitWindowStatus);
    win.on('leave-full-screen', emitWindowStatus);
    return win;
  }

  app.on('second-instance', showWindow);
  app.on('before-quit', () => {
    quitting = true;
  });

  app.whenReady().then(async () => {
    if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      handleAppScheme(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`));
    }
    applySessionPolicy();
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null);

    const paths = appPaths();
    services = createServices({ paths, tray, shortcuts, window: () => mainWindow });
    const s = services;
    registerIpc(s);
    void s.models.discover().catch((error: unknown) => console.error('Model discovery failed', error));

    const applyTheme = () => {
      nativeTheme.themeSource = s.settings.get().appearance.theme;
    };
    applyTheme();
    nativeTheme.on('updated', applyTheme);

    const applySystem = () => {
      const { launchAtLogin } = s.settings.get().system;
      if (process.platform !== 'linux') app.setLoginItemSettings({ openAtLogin: launchAtLogin });
    };
    applySystem();
    shortcuts.apply(s.settings.get());

    s.settings.on('change', (next, previous) => {
      if (next.appearance.theme !== previous.appearance.theme) applyTheme();
      if (
        next.dictation.shortcut !== previous.dictation.shortcut ||
        next.tts.shortcut !== previous.tts.shortcut
      ) {
        shortcuts.apply(next);
      }
      if (next.system.launchAtLogin !== previous.system.launchAtLogin) applySystem();
      if (next.stt.modelId !== previous.stt.modelId) void s.inference.unload('stt').catch(() => undefined);
      send(EVENTS.settingsChanged, next);
      send(EVENTS.statusChanged);
    });
    s.models.on('progress', (event) => {
      send(EVENTS.modelProgress, event);
      if (event.state === 'installed' || event.state === 'missing' || event.state === 'error') {
        send(EVENTS.statusChanged);
      }
    });
    s.inference.on('health', () => send(EVENTS.statusChanged));

    powerMonitor.on('suspend', () => command('dictation:cancel'));
    powerMonitor.on('on-battery', () => send(EVENTS.statusChanged));
    powerMonitor.on('on-ac', () => send(EVENTS.statusChanged));

    if (process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('microphone') === 'not-determined') {
      await systemPreferences.askForMediaAccess('microphone');
    }

    tray.create();
    mainWindow = openWindow();
    void s.inference.start().catch((error: unknown) => console.error(error));
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = openWindow();
    else showWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !services?.settings.get().system.closeToTray) app.quit();
  });

  app.on('will-quit', () => {
    shortcuts.clear();
    tray.destroy();
    services?.models.cancelAll();
    void services?.inference.stop();
    services?.history.close();
  });
}
