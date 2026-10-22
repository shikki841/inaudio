import { CloudShader } from '@renderer/components/ui/cloud-shader';

export function WhatsNewHero() {
  return (
    <CloudShader className="h-full w-full">
      <div className="grid size-full place-items-center p-4">
        <svg aria-hidden viewBox="0 0 300 150" className="h-full max-w-full">
          <g stroke="var(--line-strong)" strokeWidth="1.5">
            <rect x="69" y="19" width="162" height="116" rx="13" fill="var(--surface)" />
            <path d="M70 48h160" />
            <circle cx="84" cy="34" r="3" fill="var(--accent)" stroke="none" />
            <circle cx="95" cy="34" r="3" fill="var(--accent-soft)" stroke="none" />
          </g>
          <rect x="91" y="63" width="92" height="8" rx="4" fill="var(--ink)" opacity=".78" />
          <rect x="91" y="81" width="119" height="6" rx="3" fill="var(--line-strong)" />
          <rect x="91" y="94" width="102" height="6" rx="3" fill="var(--line-strong)" />
          <rect x="91" y="111" width="55" height="13" rx="6.5" fill="var(--accent-soft)" />
          <path d="m218 54 4 8 9 1-6.5 6.2 1.5 8.8-8-4.2-8 4.2 1.5-8.8-6.5-6.2 9-1 4-8Z" fill="var(--accent)" />
          <path d="m53 91 2.5 5 5.5.7-4 3.8 1 5.5-5-2.6-5 2.6 1-5.5-4-3.8 5.5-.7 2.5-5Z" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
          <path d="M226 113c8-8 17-8 25 0" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity=".65" />
        </svg>
      </div>
    </CloudShader>
  );
}

export function ReleaseNotesHero() {
  return (
    <CloudShader className="h-full w-full">
      <div className="grid size-full place-items-center p-3">
        <svg aria-hidden viewBox="0 0 300 140" className="h-full max-w-full">
          <path d="M72 24c0-6 5-10 11-10h99c6 0 11 4 11 10v94c-26-11-51-11-77 0-16-9-30-10-44-8V24Z" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" />
          <path d="M193 24c0-6 5-10 11-10h13c6 0 11 4 11 10v86c-11-4-23-3-35 4V24Z" fill="var(--accent-soft)" stroke="var(--line-strong)" strokeWidth="1.5" />
          <path d="M88 39h67" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" />
          <path d="M88 57h80M88 70h69M88 83h77" stroke="var(--line-strong)" strokeWidth="5" strokeLinecap="round" />
          <circle cx="95" cy="101" r="4" fill="var(--accent)" />
          <path d="M107 101h45" stroke="var(--line-strong)" strokeWidth="5" strokeLinecap="round" />
          <path d="m235 51 4 8 9 1-6.5 6.2 1.5 8.8-8-4.2-8 4.2 1.5-8.8-6.5-6.2 9-1 4-8Z" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
          <path d="M204 96h19m-9-9v18" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity=".7" />
          <circle cx="56" cy="48" r="5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
          <circle cx="51" cy="101" r="3" fill="var(--accent)" opacity=".55" />
        </svg>
      </div>
    </CloudShader>
  );
}
