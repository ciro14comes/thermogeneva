// Icone SVG inline, stile lineare minimale (tratto sottile, angoli arrotondati), nessuna libreria esterna.
type P = { size?: number };
const base = (size = 18) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
});

export const IconHome = ({ size }: P) => (
  <svg {...base(size)}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M3.5 10h17M10 10v10.5" /></svg>
);
export const IconMap = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 20.5s-6.5-5.5-6.5-10.75a6.5 6.5 0 0 1 13 0c0 5.25-6.5 10.75-6.5 10.75z" /><circle cx="12" cy="9.75" r="2.25" /></svg>
);
export const IconZones = ({ size }: P) => (
  <svg {...base(size)}><path d="m12 3.75 8.25 4.5L12 12.75 3.75 8.25z" /><path d="m3.75 12.25 8.25 4.5 8.25-4.5" /><path d="m3.75 16.25 8.25 4.5 8.25-4.5" /></svg>
);
export const IconBook = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 6.75C10.2 5.2 7.4 4.75 4 4.75v13c3.4 0 6.2.45 8 2 1.8-1.55 4.6-2 8-2v-13c-3.4 0-6.2.45-8 2z" /><path d="M12 6.75v13" /></svg>
);
export const IconDatabase = ({ size }: P) => (
  <svg {...base(size)}><ellipse cx="12" cy="6" rx="7.5" ry="2.75" /><path d="M4.5 6v12c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75V6" /><path d="M4.5 12c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75" /></svg>
);
export const IconShield = ({ size }: P) => (
  <svg {...base(size)}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
);
export const IconGithub = ({ size }: P) => (
  <svg {...base(size)}><path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" /></svg>
);
export const IconPanel = ({ size }: P) => (
  <svg {...base(size)}><rect x="3.5" y="4.5" width="17" height="15" rx="3.5" /><path d="M9.5 4.5v15" /></svg>
);
export const IconList = ({ size }: P) => (
  <svg {...base(size)}><path d="M9 6h12M9 12h12M9 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>
);
export const IconSearch = ({ size }: P) => (
  <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconArrowLeft = ({ size }: P) => (
  <svg {...base(size)}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
);
export const IconChevron = ({ size }: P) => (
  <svg {...base(size)}><path d="m9 6 6 6-6 6" /></svg>
);

// Croce svizzera (proporzioni ufficiali: ogni braccio è 1/6 più lungo che largo), piena.
export const IconSwissCross = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="6 6 20 20" fill="currentColor" aria-hidden="true">
    <path d="M13 6h6v7h7v6h-7v7h-6v-7H6v-6h7z" />
  </svg>
);
