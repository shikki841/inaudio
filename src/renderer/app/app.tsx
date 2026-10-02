import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ComponentType } from 'react';
import { AppShell } from '@renderer/components/shell/app-shell';
import { api } from '@renderer/lib/api';
import { keys, useSettings } from '@renderer/lib/queries';
import { useDictation } from '@renderer/stores/dictation-store';
import { useUi, type Route } from '@renderer/stores/ui-store';
import { AudioPage } from '@renderer/features/audio/audio-page';
import { useReportInputDevices } from '@renderer/features/audio/use-devices';
import { DictationPage } from '@renderer/features/dictation/dictation-page';
import { HistoryPage } from '@renderer/features/history/history-page';
import { ModelsPage } from '@renderer/features/models/models-page';
import { ReadAloudPage } from '@renderer/features/read-aloud/read-aloud-page';
import { readClipboardAloud } from '@renderer/features/read-aloud/read-aloud-store';
import { SettingsPage } from '@renderer/features/settings/settings-page';
import { SetupFlow } from '@renderer/features/setup/setup-flow';
import { LogoMark } from '@renderer/components/brand/logo';

const PAGES: Record<Route, ComponentType> = {
  dictation: DictationPage,
  history: HistoryPage,
  'read-aloud': ReadAloudPage,
  models: ModelsPage,
  audio: AudioPage,
  settings: SettingsPage,
};

function useMainEvents() {
  const client = useQueryClient();
  const navigate = useUi((s) => s.navigate);
  useEffect(() => {
    const offs = [
      api.events.onCommand((command) => {
        const dictation = useDictation.getState();
        switch (command) {
          case 'dictation:toggle':
            return void dictation.toggle();
          case 'dictation:start':
            return void dictation.start();
          case 'dictation:stop':
            return void dictation.stop();
          case 'dictation:cancel':
            return void dictation.cancel();
          case 'read-aloud:clipboard':
            return void readClipboardAloud();
          default:
            if (command.startsWith('navigate:')) navigate(command.slice('navigate:'.length) as Route);
        }
      }),
      api.events.onStatusChanged(() => {
        void client.invalidateQueries({ queryKey: keys.status });
        void client.invalidateQueries({ queryKey: keys.models });
      }),
      api.events.onSettingsChanged((settings) => {
        client.setQueryData(keys.settings, settings);
        void client.invalidateQueries({ queryKey: keys.models });
      }),
      api.events.onModelProgress(() => void client.invalidateQueries({ queryKey: keys.models })), 
    ];
    return () => offs.forEach((off) => off());
  }, [client, navigate]);
}

/** In-window hold-to-talk: while focused, holding the shortcut records and releasing stops. */
function useHoldToTalk(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const isChord = (e: KeyboardEvent) => (e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'Space';
    const down = (e: KeyboardEvent) => {
      if (isChord(e) && !e.repeat) {
        e.preventDefault();
        void useDictation.getState().start();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' && useDictation.getState().phase === 'listening') void useDictation.getState().stop();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [enabled]);
}

function useAppearance() {
  const { data: settings } = useSettings();
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    root.dataset.fontSize = settings.appearance.fontSize;
    root.dataset.fontFamily = settings.appearance.fontFamily;
    root.dataset.motion = settings.appearance.animations;
    root.dataset.accentTone = settings.appearance.accentTone;
  }, [settings]);
}

export function App() {
  const { data: settings, isLoading } = useSettings();
  const route = useUi((s) => s.route);
  useMainEvents();
  useAppearance();
  // Reports the enumerated inputs to main, which cannot see them on its own.
  useReportInputDevices();
  useHoldToTalk(settings?.dictation.mode === 'push-to-talk');

  if (isLoading || !settings) {
    return (
      <div className="grid h-full place-items-center bg-canvas text-accent">
        <LogoMark className="size-14 animate-pulse" />
      </div>
    );
  }
  if (!settings.onboardingComplete) return <SetupFlow />;
  const Page = PAGES[route];
  return (
    <AppShell>
      <Page />
    </AppShell>
  );
}
