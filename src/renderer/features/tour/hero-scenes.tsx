/** Decorative setup illustrations. Each scene is drawn in SVG so it scales cleanly over the cloud hero. */
export function WelcomeScene() {
  return (
    <svg aria-hidden="true" viewBox="0 0 560 220" preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 size-full">
      <circle cx="280" cy="108" r="84" fill="var(--accent-soft)" opacity=".72" />
      <circle cx="280" cy="108" r="67" fill="none" stroke="var(--accent)" strokeOpacity=".16" strokeWidth="1.5" />
      <g className="hero-float">
        <rect x="227" y="36" width="106" height="144" rx="28" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" />
        <rect x="242" y="51" width="76" height="114" rx="21" fill="var(--accent-soft)" />
        <circle cx="280" cy="78" r="5" fill="var(--accent)" />
        <rect x="269" y="91" width="22" height="40" rx="11" fill="var(--accent)" />
        <path d="M259 112v2a21 21 0 0 0 42 0v-2M280 135v12m-14 0h28" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path d="M187 76h24m138 0h24M204 150h18m116 0h18" stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" opacity=".72" />
      <circle cx="199" cy="113" r="4" fill="var(--accent)" opacity=".6" />
      <circle cx="361" cy="112" r="5" fill="var(--accent)" opacity=".48" />
      <path d="m374 55 4 8 9 1-6.5 6.2L382 79l-8-4.2-8 4.2 1.5-8.8-6.5-6.2 9-1 4-8Z" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
      <path d="M206 174h148" stroke="var(--line-strong)" strokeWidth="1.5" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

export function MicrophoneScene() {
  return (
    <svg aria-hidden="true" viewBox="0 0 560 220" preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 size-full">
      <circle cx="280" cy="105" r="80" fill="var(--accent-soft)" opacity=".62" />
      <circle className="hero-ring" cx="280" cy="105" r="59" fill="none" stroke="var(--accent)" strokeWidth="2" opacity=".45" />
      <circle className="hero-ring" cx="280" cy="105" r="59" fill="none" stroke="var(--accent)" strokeWidth="2" opacity=".35" style={{ animationDelay: '0.9s' }} />
      <g className="hero-float">
        <rect x="251" y="47" width="58" height="92" rx="29" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" />
        <rect x="261" y="59" width="38" height="68" rx="19" fill="var(--accent)" />
        <path d="M237 102v4a43 43 0 0 0 86 0v-4" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
        <path d="M280 149v20m-19 0h38" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
        <path d="M271 77v17m9-25v34m9-26v18" stroke="var(--surface)" strokeWidth="2.5" strokeLinecap="round" opacity=".82" />
      </g>
      <path d="M174 94c10-12 20-12 30 0m152 0c10-12 20-12 30 0M190 113c8-8 15-8 23 0m134 0c8-8 15-8 23 0" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity=".58" />
      <circle cx="207" cy="58" r="4" fill="var(--accent)" opacity=".65" />
      <circle cx="354" cy="154" r="4" fill="var(--accent)" opacity=".55" />
    </svg>
  );
}

export function ModelsScene() {
  return (
    <svg aria-hidden="true" viewBox="0 0 560 220" preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 size-full">
      <circle cx="280" cy="110" r="93" fill="var(--accent-soft)" opacity=".55" />
      <g className="hero-float-late">
        <rect x="168" y="48" width="224" height="124" rx="18" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" />
        <rect x="184" y="64" width="38" height="38" rx="12" fill="var(--accent-soft)" />
        <path d="m203 72 10 5.5v11L203 94l-10-5.5v-11l10-5.5Zm0 0v11m-10-5.5 10 5.5 10-5.5" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />
        <rect x="235" y="69" width="104" height="8" rx="4" fill="var(--ink)" opacity=".76" />
        <rect x="235" y="84" width="72" height="6" rx="3" fill="var(--line-strong)" />
        <rect x="184" y="119" width="192" height="9" rx="4.5" fill="var(--line)" />
        <rect className="hero-fill" x="184" y="119" width="145" height="9" rx="4.5" fill="var(--accent)" />
        <circle cx="362" cy="80" r="10" fill="var(--accent-soft)" />
        <path d="m358 80 3 3 5-6" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="184" y="145" width="66" height="6" rx="3" fill="var(--line-strong)" opacity=".66" />
        <rect x="342" y="140" width="34" height="18" rx="9" fill="var(--accent-soft)" />
        <path d="M353 149h12" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      </g>
      <path d="M132 93h18m260 44h18" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity=".5" />
      <circle cx="145" cy="137" r="4" fill="var(--accent)" opacity=".55" />
      <circle cx="417" cy="82" r="5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
}

export function LiveScene() {
  return (
    <svg aria-hidden="true" viewBox="0 0 560 220" preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 size-full">
      <ellipse cx="280" cy="178" rx="122" ry="16" fill="var(--accent)" opacity=".08" />
      <g className="hero-float">
        <rect x="163" y="39" width="234" height="132" rx="17" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" />
        <path d="M164 56c0-9 7-16 16-16h200c9 0 16 7 16 16v18H164V56Z" fill="var(--accent-soft)" />
        <circle cx="181" cy="57" r="4" fill="var(--record)" />
        <circle cx="195" cy="57" r="3" fill="var(--line-strong)" />
        <circle cx="207" cy="57" r="3" fill="var(--line-strong)" />
        <rect x="223" y="53" width="64" height="7" rx="3.5" fill="var(--line-strong)" opacity=".7" />
        <path d="M187 94h151M187 111h176M187 128h116" stroke="var(--line-strong)" strokeWidth="6" strokeLinecap="round" opacity=".72" />
        <path d="M187 94h90" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" opacity=".65" />
        <rect x="330" y="145" width="47" height="14" rx="7" fill="var(--accent-soft)" />
        <path d="M342 152h2m5-4v8m5-10v12m5-7v7m5-10v10" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      </g>
      <path d="M126 73v18m-9-9h18m296 62v18m-9-9h18" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity=".55" />
      <circle cx="419" cy="72" r="4" fill="var(--accent)" opacity=".58" />
    </svg>
  );
}

export function OverlayScene() {
  return (
    <svg aria-hidden="true" viewBox="0 0 560 220" preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 size-full">
      <rect x="111" y="31" width="338" height="156" rx="18" fill="var(--surface)" opacity=".56" stroke="var(--line-strong)" strokeWidth="1.5" />
      <path d="M112 49c0-10 8-18 18-18h300c10 0 18 8 18 18v18H112V49Z" fill="var(--accent-soft)" opacity=".9" />
      <circle cx="132" cy="49" r="3.5" fill="var(--accent)" />
      <circle cx="145" cy="49" r="3.5" fill="var(--line-strong)" />
      <circle cx="158" cy="49" r="3.5" fill="var(--line-strong)" />
      <path d="M136 91h90m-90 16h142m-142 16h108" stroke="var(--line-strong)" strokeWidth="6" strokeLinecap="round" opacity=".55" />
      <g className="hero-rise">
        <rect x="177" y="135" width="206" height="49" rx="24.5" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" />
        <circle className="hero-dot" cx="201" cy="159" r="5" fill="var(--record)" />
        <rect x="217" y="154" width="75" height="9" rx="4.5" fill="var(--ink)" opacity=".76" />
        <path d="M320 165v-10m8 10v-16m8 16v-7m8 7v-13m8 13v-9" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx="404" cy="106" r="5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
}
