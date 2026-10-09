import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { companionBubbleText, type CompanionSnapshot } from '@shared/domain/companion';
import type { VoiceId } from '@shared/domain/models';
import { api } from './lib/api';
import './styles/index.css';
import { BuddySprite } from './features/companion/buddy-sprite';
import { playCue } from './features/dictation/audio/cues';
import { PcmPlayer } from './lib/audio-player';

function Companion() {
  const [snapshot, setSnapshot] = useState<CompanionSnapshot | null>(null);
  const [outputDeviceId, setOutputDeviceId] = useState('default');
  const [tts, setTts] = useState<{ voiceId?: VoiceId; speed?: number }>({});
  const previousState = useRef<CompanionSnapshot['state'] | null>(null);
  const spokenRevision = useRef(0);
  const speech = useRef(new PcmPlayer());
  const speechJob = useRef(0);

  useEffect(() => {
    let mounted = true;
    const player = speech.current;
    void api.companions.get().then((value) => {
      if (mounted) setSnapshot(value);
    });
    void api.settings.get().then((value) => {
      if (mounted) setOutputDeviceId(value.audio.outputDeviceId);
      if (mounted) setTts({ voiceId: value.tts.voiceId as VoiceId, speed: value.tts.speed });
    });
    const off = api.events.onCompanionState((value) => setSnapshot(value));
    const offSettings = api.events.onSettingsChanged((value) => {
      setOutputDeviceId(value.audio.outputDeviceId);
      setTts({ voiceId: value.tts.voiceId as VoiceId, speed: value.tts.speed });
    });
    return () => {
      mounted = false;
      off();
      offSettings();
      player.stop();
    };
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    const previous = previousState.current;
    previousState.current = snapshot.state;
    if (!snapshot.settings.soundEnabled || previous === null || previous === snapshot.state) return;
    const cue =
      snapshot.state === 'listening'
        ? 'start'
        : snapshot.state === 'speaking'
          ? 'ready'
          : snapshot.state === 'error' || snapshot.state === 'model-unavailable'
            ? 'error'
            : snapshot.state === 'attention'
              ? 'attention'
              : snapshot.state === 'ready'
                ? 'stop'
                : null;
    if (cue) void playCue(cue, { volume: snapshot.settings.soundVolume, outputDeviceId });
  }, [outputDeviceId, snapshot]);

  useEffect(() => {
    if (
      !snapshot ||
      !snapshot.settings.voiceEnabled ||
      !snapshot.settings.soundEnabled ||
      !snapshot.event ||
      snapshot.state === 'listening' ||
      snapshot.state === 'transcribing' ||
      snapshot.event === 'dictation.started' ||
      snapshot.event === 'dictation.stopped' ||
      snapshot.revision === spokenRevision.current ||
      snapshot.event === 'tts.started' ||
      snapshot.event === 'tts.completed'
    ) return;
    spokenRevision.current = snapshot.revision;
    const job = ++speechJob.current;
    speech.current.stop();
    void api.tts.speak({ text: companionBubbleText(snapshot.state, snapshot.settings.position === 'focus-area'), ...tts })
      .then((result) => {
        if (job === speechJob.current) {
          return speech.current.play(
            result.samples,
            result.sampleRate,
            outputDeviceId,
            () => undefined,
            snapshot.settings.soundVolume,
          );
        }
        return undefined;
      })
      .catch(() => undefined);
  }, [outputDeviceId, snapshot, tts]);

  if (!snapshot) return null;
  const { companion, settings, state } = snapshot;
  const bubble = companionBubbleText(state, snapshot.settings.position === 'focus-area');
  document.body.dataset.surface = 'companion';
  document.body.dataset.motion = settings.motion;
  return (
    <button
      type="button"
      aria-label={`${companion.displayName}, ${state}`}
      className={`companion-stage companion-stage-${state} group grid size-full place-items-center border-0 bg-transparent p-0 outline-none`}
      onMouseEnter={() => api.companions.hover(true)}
      onMouseLeave={() => api.companions.hover(false)}
      onClick={() => void api.companions.click().catch(() => undefined)}
    >
      {settings.bubble !== 'hidden' && <span className={`companion-bubble companion-bubble-${settings.bubble}`} role="status">{bubble}</span>}
      <span className="companion-sprite" style={{ filter: `drop-shadow(0 10px 18px ${companion.color}66)` }}>
        <BuddySprite companion={companion} state={state} size="large" />
      </span>
    </button>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(<Companion />);
