import { useEffect, useState } from 'react';

export function useMediaDevices(kind: MediaDeviceKind) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
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
