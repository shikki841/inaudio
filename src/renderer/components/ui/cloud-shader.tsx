import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@renderer/lib/cn';
import { useSettings } from '@renderer/lib/queries';

const vertexShader = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const fragmentShader = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_sky;
uniform vec3 u_cloud;
uniform vec3 u_accent;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float cloudNoise(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += noise(p) * amplitude;
    p = p * 2.03 + vec2(17.1, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / max(u_resolution, vec2(1.0));
  uv.y = 1.0 - uv.y;
  vec2 p = uv * vec2(3.2, 2.0);
  float drift = u_time * 0.018;
  float broad = cloudNoise(p + vec2(drift, 0.0));
  float detail = cloudNoise(p * 1.75 + vec2(-drift * 0.45, 13.7));
  float field = broad * 0.72 + detail * 0.28 + (1.0 - uv.y) * 0.045;
  float coverage = smoothstep(0.42, 0.59, field);
  float edgeLight = smoothstep(0.44, 0.63, field) * (1.0 - smoothstep(0.64, 0.76, field));
  vec3 cloud = mix(u_cloud, u_accent, edgeLight * 0.18);
  gl_FragColor = vec4(mix(u_sky, cloud, coverage), 1.0);
}`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create cloud shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Cloud shader compilation failed.';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function colorUniform(gl: WebGLRenderingContext, program: WebGLProgram, name: string, color: string): void {
  const values = color.match(/[\da-f]{2}/gi)?.map((part) => parseInt(part, 16) / 255) ?? [0.5, 0.5, 0.5];
  const location = gl.getUniformLocation(program, name);
  if (location) gl.uniform3f(location, values[0] ?? 0.5, values[1] ?? 0.5, values[2] ?? 0.5);
}

function tokenColor(element: HTMLElement, token: string): string {
  const color = getComputedStyle(element).getPropertyValue(token).trim();
  if (color.startsWith('#')) return color;
  const rgb = color.match(/[\d.]+/g)?.slice(0, 3).map((part) => Math.round(Number(part)).toString(16).padStart(2, '0'));
  return rgb?.length === 3 ? `#${rgb.join('')}` : '#808080';
}

/** A small, dependency-free WebGL cloud field for announcement heroes. */
export function CloudShader({ className, children }: { className?: string; children?: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { data: settings } = useSettings();
  const motion = settings?.appearance.animations ?? 'full';
  const [systemReduced, setSystemReduced] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let frame = 0;
    let resizeObserver: ResizeObserver | undefined;
    let lastFrame = 0;
    const animate = motion === 'full' && !systemReduced;

    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
      if (!gl) throw new Error('WebGL is unavailable.');
      const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
      const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
      program = gl.createProgram();
      if (!program) throw new Error('Could not create cloud shader program.');
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Cloud shader link failed.');

      const position = gl.getAttribLocation(program, 'a_position');
      buffer = gl.createBuffer();
      if (!buffer) throw new Error('Could not create cloud shader buffer.');
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.useProgram(program);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const resize = () => {
        if (!gl || !program) return;
        const scale = Math.min(window.devicePixelRatio || 1, 1.5);
        const width = Math.max(1, Math.round(parent.clientWidth * scale));
        const height = Math.max(1, Math.round(parent.clientHeight * scale));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
        gl.useProgram(program);
        gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), width, height);
        colorUniform(gl, program, 'u_sky', tokenColor(parent, '--accent-soft'));
        colorUniform(gl, program, 'u_cloud', tokenColor(parent, '--surface'));
        colorUniform(gl, program, 'u_accent', tokenColor(parent, '--accent'));
      };

      const draw = (now: number) => {
        if (!gl || !program) return;
        if (!animate || now - lastFrame >= 32) {
          lastFrame = now;
          gl.useProgram(program);
          gl.uniform1f(gl.getUniformLocation(program, 'u_time'), animate ? now / 1000 : 0);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        if (animate) frame = requestAnimationFrame(draw);
      };

      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(parent);
      setSupported(true);
      frame = requestAnimationFrame(draw);

      const onLost = (event: Event) => {
        event.preventDefault();
        cancelAnimationFrame(frame);
        setSupported(false);
      };
      canvas.addEventListener('webglcontextlost', onLost);
      return () => {
        canvas.removeEventListener('webglcontextlost', onLost);
        cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        if (buffer) gl?.deleteBuffer(buffer);
        if (program) gl?.deleteProgram(program);
      };
    } catch {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      if (buffer) gl?.deleteBuffer(buffer);
      if (program) gl?.deleteProgram(program);
      setSupported(false);
      return;
    }
  }, [motion, systemReduced]);

  return (
    <div className={cn('relative isolate overflow-hidden bg-accent-soft', className)}>
      <svg aria-hidden className={cn('pointer-events-none absolute inset-0 size-full', supported && 'hidden')} viewBox="0 0 600 220" preserveAspectRatio="xMidYMid slice">
        <path d="M0 158c30-25 49-29 76-16 20-38 74-35 90 4 35-5 56 11 59 38H0Zm320-34c18-31 62-36 85-10 27-17 62-5 67 27 26-2 47 10 53 28H298c2-18 8-34 22-45Zm159 96c20-23 56-29 78-10 14-16 39-14 51 2v18H479Z" fill="var(--surface)" opacity=".82" />
        <path d="M54 58c12-21 39-24 55-7 18-9 39 4 39 23H40c1-8 6-13 14-16Zm358 15c12-20 38-24 55-8 16-8 37 4 37 22H344c2-7 8-12 16-14Z" fill="var(--surface)" opacity=".58" />
      </svg>
      <canvas ref={canvasRef} aria-hidden className={cn('absolute inset-0 size-full', !supported && 'hidden')} />
      <div className="absolute inset-0 z-10">{children}</div>
    </div>
  );
}
