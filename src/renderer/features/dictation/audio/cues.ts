/** Short synthesized tones so no audio assets are needed. */
export async function playCue(
  kind: 'start' | 'stop' | 'error' | 'ready' | 'attention',
  options: { volume?: number; outputDeviceId?: string } = {},
): Promise<void> {
  const context = new AudioContext();
  if (options.outputDeviceId && options.outputDeviceId !== 'default' && 'setSinkId' in context) {
    try {
      await (context as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(options.outputDeviceId);
    } catch {
      // The output can disappear between enumeration and playback; use the system default.
    }
  }
  const osc = context.createOscillator();
  const gain = context.createGain();
  const [from, to] =
    kind === 'start'
      ? [660, 880]
      : kind === 'stop'
        ? [880, 660]
        : kind === 'ready'
          ? [520, 720]
          : kind === 'attention'
            ? [760, 520]
            : [330, 220];
  const now = context.currentTime;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.linearRampToValueAtTime(to, now + 0.09);
  gain.gain.setValueAtTime(0.0001, now);
  const volume = Math.max(0, Math.min(1, options.volume ?? 0.8));
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.1), now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  osc.connect(gain).connect(context.destination);
  osc.start(now);
  osc.stop(now + 0.15);
  osc.onended = () => void context.close();
}
