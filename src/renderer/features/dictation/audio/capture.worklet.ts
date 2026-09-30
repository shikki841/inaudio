// AudioWorklet that forwards mono float32 frames and a peak level to the main thread.
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void;

class CaptureProcessor extends AudioWorkletProcessor {
  private buffer = new Float32Array(Math.round(sampleRate / 20));
  private filled = 0;

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    let offset = 0;
    while (offset < channel.length) {
      const take = Math.min(channel.length - offset, this.buffer.length - this.filled);
      this.buffer.set(channel.subarray(offset, offset + take), this.filled);
      this.filled += take;
      offset += take;
      if (this.filled === this.buffer.length) {
        let peak = 0;
        for (const v of this.buffer) peak = Math.max(peak, Math.abs(v));
        const chunk = this.buffer.slice();
        this.port.postMessage({ chunk, peak }, [chunk.buffer]);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('inaudio-capture', CaptureProcessor);
