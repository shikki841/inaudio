/** Plays float32 PCM from the TTS engine on a chosen output device. */
export class PcmPlayer {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;

  async play(
    samples: Float32Array,
    sampleRate: number,
    outputDeviceId: string,
    onEnded: () => void,
    volume = 1,
  ): Promise<void> {
    this.stop();
    const context = new AudioContext({ sampleRate });
    this.context = context;
    if (outputDeviceId && outputDeviceId !== 'default' && 'setSinkId' in context) {
      try {
        await (context as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(outputDeviceId);
      } catch {
        // Device vanished; fall back to the default output.
      }
    }
    const buffer = context.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(new Float32Array(samples), 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.connect(gain);
    gain.connect(context.destination);
    source.onended = () => {
      if (this.source === source) {
        this.stop();
        onEnded();
      }
    };
    this.source = source;
    source.start();
  }

  stop(): void {
    const source = this.source;
    this.source = null;
    try {
      source?.stop();
    } catch {
      // Already stopped.
    }
    if (this.context && this.context.state !== 'closed') void this.context.close();
    this.context = null;
  }
}

/** Encodes mono float32 PCM as a 16-bit WAV for export. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((v, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  return new Blob([view], { type: 'audio/wav' });
}
