import { app, BrowserWindow, Menu, nativeTheme, powerMonitor, systemPreferences } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import type { AppCommand } from '@shared/domain/system';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import { EVENTS } from '@shared/ipc/channels';
import { appPaths } from './app/paths';
import { registerIpc } from './ipc/register';
import { handleAppScheme, registerAppScheme } from './security/app-protocol';
import { applySessionPolicy } from './security/hardening';
import { registerSurface } from './security/surfaces';
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
  const sendCommand = (value: AppCommand): boolean => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
      return false;
    }
    mainWindow.webContents.send(EVENTS.command, value);
    return true;
  };
  const command = (value: AppCommand) => {
    sendCommand(value);
  };

  const showWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = openWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  };

  function openWindow(): BrowserWindow {
    const win = createMainWindow();
    registerSurface(win.webContents, 'main');
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

  const tray = new TrayService(
    {
      show: showWindow,
      startDictation: () => command('dictation:start'),
      stopDictation: () => command('dictation:stop'),
      cancelDictation: () => command('dictation:cancel'),
      readClipboard: () => command('read-aloud:clipboard'),
      openSettings: () => {
        showWindow();
        command('navigate:settings');
      },
      selectMicrophone: (id) => {
        if (!services) return;
        try {
          services.updateSettings({ audio: { inputDeviceId: id } });
        } catch (error) {
          console.error('Could not switch microphone', error);
        }
      },
      toggleOverlay: () => {
        const current = services?.settings.get();
        if (!current) return;
        const enabled = !current.overlay.enabled;
        services?.updateSettings({ overlay: { enabled } });
      },
      quit: () => {
        quitting = true;
        app.quit();
      },
    },
    DEFAULT_SETTINGS,
  );

  const shortcuts = new ShortcutService({
    dictation: () => command('dictation:toggle'),
    readAloud: () => command('read-aloud:clipboard'),
    cancel: () => command('dictation:cancel'),
    overlay: () => {
      const current = services?.settings.get();
      if (current) services?.updateSettings({ overlay: { enabled: !current.overlay.enabled } });
    },
  });

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
    services = createServices({
      paths,
      tray,
      shortcuts,
      window: () => mainWindow,
      command: sendCommand,
      showWindow,
    });
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
    tray.apply(s.settings.get());
    s.overlay.sync();

    s.settings.on('change', (next, previous) => {
      if (next.appearance.theme !== previous.appearance.theme) applyTheme();
      if (
        next.dictation.shortcut !== previous.dictation.shortcut ||
        next.dictation.cancelShortcut !== previous.dictation.cancelShortcut ||
        next.tts.shortcut !== previous.tts.shortcut ||
        next.overlay.toggleShortcut !== previous.overlay.toggleShortcut
      ) {
        shortcuts.apply(next);
      }
      if (next.system.launchAtLogin !== previous.system.launchAtLogin) applySystem();
      if (next.stt.modelId !== previous.stt.modelId) void s.inference.unload('stt').catch(() => undefined);
      if (JSON.stringify(next.overlay) !== JSON.stringify(previous.overlay)) s.overlay.sync();
      if (JSON.stringify(next.tray) !== JSON.stringify(previous.tray)) tray.apply(next);
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

    // Audio devices do not survive a sleep, so a recording in flight is abandoned.
    powerMonitor.on('suspend', () => s.dictation.interrupt());
    powerMonitor.on('on-battery', () => send(EVENTS.statusChanged));
    powerMonitor.on('on-ac', () => send(EVENTS.statusChanged));

    if (process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('microphone') === 'not-determined') {
      await systemPreferences.askForMediaAccess('microphone');
    }

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

  app.on('will-quit', (event) => {
    shortcuts.clear();
    if (!services) {
      tray.destroy();
      return;
    }
    event.preventDefault();
    const disposing = services.dispose();
    void disposing.finally(() => {
      tray.destroy();
      app.exit(0);
    });
  });
}
