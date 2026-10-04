import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CompanionSnapshot } from '@shared/domain/companion';
import { api } from './lib/api';
import './styles/index.css';
import { BuddySprite } from './features/companion/buddy-sprite';

function Companion() {
  const [snapshot, setSnapshot] = useState<CompanionSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;
    void api.companions.get().then((value) => {
      if (mounted) setSnapshot(value);
    });
    const off = api.events.onCompanionState((value) => setSnapshot(value));
    return () => {
      mounted = false;
      off();
    };
  }, []);

  if (!snapshot) return null;
  const { companion, settings, state } = snapshot;
  const bubble =
    snapshot.settings.position === 'focus-area' && state === 'transcribing'
      ? 'I’m writing…'
      : state === 'listening'
      ? 'Listening…'
      : state === 'transcribing'
        ? 'Transcribing…'
        : state === 'speaking'
          ? 'Speaking…'
          : state === 'thinking'
            ? 'Thinking…'
            : state === 'error'
              ? 'Needs attention'
              : state === 'attention'
                ? 'I’m here'
                : state === 'sleeping'
                  ? 'Taking a pause'
                  : 'Ready';
  document.body.dataset.surface = 'companion';
  document.body.dataset.motion = settings.motion;
  return (
    <button
      type="button"
      aria-label={`${companion.displayName}, ${state}`}
      className={`companion-stage companion-stage-${state} group grid size-full place-items-center border-0 bg-transparent p-0 outline-none`}
      onClick={() =>
        void api.companions.update({
          ...snapshot.settings,
          clickThrough: false,
        })
      }
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
