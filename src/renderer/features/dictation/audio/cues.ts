/** Short synthesized start/stop tones so no audio assets are needed. */
export function playCue(kind: 'start' | 'stop' | 'error'): void {
  const context = new AudioContext();
  const osc = context.createOscillator();
  const gain = context.createGain();
  const [from, to] = kind === 'start' ? [660, 880] : kind === 'stop' ? [880, 660] : [330, 220];
  const now = context.currentTime;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.linearRampToValueAtTime(to, now + 0.09);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  osc.connect(gain).connect(context.destination);
  osc.start(now);
  osc.stop(now + 0.15);
  osc.onended = () => void context.close();
}
