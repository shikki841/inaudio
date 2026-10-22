import { CloudShader } from '@renderer/components/ui/cloud-shader';

export function WhatsNewHero() {
  return (
    <CloudShader className="size-full">
      <svg aria-hidden="true" viewBox="0 0 560 220" preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 size-full">
        <defs>
          <linearGradient id="whats-new-mark" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity=".58" />
          </linearGradient>
        </defs>
        <circle cx="279" cy="112" r="94" fill="var(--surface)" opacity=".18" />
        <g className="hero-float">
          <rect x="171" y="35" width="218" height="150" rx="20" fill="var(--surface)" fillOpacity=".94" stroke="var(--line-strong)" strokeWidth="1.5" />
          <path d="M172 55c0-11 9-20 20-20h176c11 0 20 9 20 20v20H172V55Z" fill="var(--accent-soft)" />
          <circle cx="192" cy="55" r="4" fill="var(--accent)" />
          <circle cx="207" cy="55" r="4" fill="var(--line-strong)" />
          <circle cx="222" cy="55" r="4" fill="var(--line-strong)" />
          <rect x="191" y="92" width="48" height="48" rx="16" fill="url(#whats-new-mark)" />
          <path d="M215 103v16m-8-8h16m-8 8 6 7m-6-7-6 7" fill="none" stroke="var(--surface)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="256" y="94" width="101" height="9" rx="4.5" fill="var(--ink)" opacity=".82" />
          <rect x="256" y="111" width="81" height="6" rx="3" fill="var(--line-strong)" />
          <rect x="256" y="124" width="94" height="6" rx="3" fill="var(--line-strong)" opacity=".72" />
          <rect x="191" y="153" width="174" height="1.5" rx=".75" fill="var(--line)" />
          <circle cx="199" cy="168" r="3" fill="var(--accent)" />
          <rect x="210" y="165" width="65" height="6" rx="3" fill="var(--line-strong)" />
          <rect x="337" y="162" width="28" height="12" rx="6" fill="var(--accent-soft)" />
        </g>
        <g className="hero-float-late">
          <circle cx="411" cy="76" r="22" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" />
          <path d="m411 62 4.2 8.8 9.8 1.4-7 6.8 1.7 9.7-8.7-4.6-8.7 4.6 1.7-9.7-7-6.8 9.8-1.4 4.2-8.8Z" fill="var(--accent)" />
        </g>
        <circle cx="145" cy="136" r="5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
        <path d="M131 70h20m-10-10v20M402 146h20m-10-10v20" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity=".56" />
      </svg>
    </CloudShader>
  );
}

export function ReleaseNotesHero() {
  return (
    <CloudShader className="size-full">
      <svg aria-hidden="true" viewBox="0 0 560 220" preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 size-full">
        <defs>
          <linearGradient id="release-page" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="var(--surface)" />
            <stop offset="1" stopColor="var(--accent-soft)" />
          </linearGradient>
        </defs>
        <ellipse cx="280" cy="176" rx="130" ry="15" fill="var(--accent)" opacity=".09" />
        <g className="hero-float">
          <path d="M173 52c35-9 70-6 106 8v104c-36-14-71-17-106-8V52Z" fill="url(#release-page)" stroke="var(--line-strong)" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M279 60c36-14 71-17 108-8v104c-37-9-72-6-108 8V60Z" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M279 61v101" stroke="var(--line-strong)" strokeWidth="1.5" />
          <path d="M194 73h48" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" />
          <path d="M194 94h62m-62 14h68m-68 14h48" stroke="var(--line-strong)" strokeWidth="5" strokeLinecap="round" />
          <circle cx="199" cy="143" r="4" fill="var(--accent)" />
          <path d="M211 143h44" stroke="var(--line-strong)" strokeWidth="5" strokeLinecap="round" />
          <path d="M302 78h58m-58 14h49m-49 14h55m-55 14h41" stroke="var(--line-strong)" strokeWidth="5" strokeLinecap="round" />
          <rect x="302" y="135" width="42" height="14" rx="7" fill="var(--accent-soft)" />
          <circle cx="312" cy="142" r="3" fill="var(--accent)" />
          <path d="M321 142h15" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="hero-float-late">
          <circle cx="410" cy="78" r="19" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" />
          <path d="m410 66 3.5 7.3 8 1.2-5.8 5.6 1.4 8-7.1-3.8-7.1 3.8 1.4-8-5.8-5.6 8-1.2L410 66Z" fill="var(--accent)" />
        </g>
        <circle cx="147" cy="101" r="5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
        <path d="M139 153h19m-9.5-9.5v19" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity=".6" />
      </svg>
    </CloudShader>
  );
}
