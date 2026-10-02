import { useEffect, useState } from 'react';
import type { AudioDevice } from '@shared/domain/system';
import { MAX_AUDIO_DEVICES, MAX_DEVICE_LABEL_CHARS } from '@shared/ipc/schemas';
import { api } from '@renderer/lib/api';

/**
 * Chromium only labels devices once microphone permission is granted, so an unlabeled
 * entry gets a positional name rather than being shown as a blank menu row. Before the
 * permission is granted the ids are empty, and those entries are not worth reporting.
 */
function describe(devices: MediaDeviceInfo[]): AudioDevice[] {
  return devices
    .filter((device) => device.deviceId)
    .slice(0, MAX_AUDIO_DEVICES)
    .map((device, index) => ({
      id: device.deviceId,
      label: (device.label || `Microphone ${index + 1}`).slice(0, MAX_DEVICE_LABEL_CHARS),
    }));
}

export function useMediaDevices(kind: MediaDeviceKind) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const load = () =>
      void navigator.mediaDevices
        .enumerateDevices()
        .then((all) => setDevices(all.filter((d) => d.kind === kind && d.deviceId !== 'communications')));
    load();
    navigator.mediaDevices.addEventListener('devicechange', load);
    return () => navigator.mediaDevices.removeEventListener('devicechange', load);
  }, [kind]);
  return devices;
}

/**
 * The main process cannot enumerate devices itself, so this window is the only source for
 * the tray submenu and for the set of input ids settings are allowed to name.
 */
export function useReportInputDevices(): void {
  const inputs = useMediaDevices('audioinput');
  useEffect(() => {
    api.audio.report(describe(inputs));
  }, [inputs]);
}
