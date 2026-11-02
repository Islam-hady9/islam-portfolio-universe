import type { SVGProps } from 'react';
import type { IconName } from '@/content/icon-names';

/**
 * Original outlined icon set: 24×24 grid, 1.5 stroke, round joins (spec §3.4).
 * Icons are decorative by default (aria-hidden); pass `title` to expose a label.
 */
const paths: Record<IconName, React.ReactNode> = {
  'arrow-left': <path d="M19 12H5m6-6-6 6 6 6" />,
  'arrow-right': <path d="M5 12h14m-6-6 6 6-6 6" />,
  'arrow-up-right': <path d="M7 17 17 7M9 7h8v8" />,
  brain: (
    <>
      <path d="M9.5 4.5a3 3 0 0 0-3 3v.2A3.2 3.2 0 0 0 4 10.8a3.3 3.3 0 0 0 1.3 2.6A3.2 3.2 0 0 0 7 18.5a2.9 2.9 0 0 0 5 .5V6a2.5 2.5 0 0 0-2.5-1.5Z" />
      <path d="M14.5 4.5a3 3 0 0 1 3 3v.2a3.2 3.2 0 0 1 2.5 3.1 3.3 3.3 0 0 1-1.3 2.6 3.2 3.2 0 0 1-1.7 5.1 2.9 2.9 0 0 1-5 .5" />
      <path d="M8.5 9.5c1 0 1.8.6 2 1.5M15.5 9.5c-1 0-1.8.6-2 1.5M8 14.5h1.5M14.5 14.5H16" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3.5" y="7" width="17" height="12.5" rx="2.5" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17M11 12.5v1.5h2v-1.5" />
    </>
  ),
  chart: <path d="M4 19.5h16M6.5 16v-4M10.5 16V8M14.5 16v-6M18.5 16V5" />,
  chat: (
    <path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4.5 20l1.3-4.2A7.5 7.5 0 1 1 20 12ZM9 12h.01M12.5 12h.01M16 12h.01" />
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  chip: (
    <>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      <path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  code: <path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5M13.5 5l-3 14" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" />
    </>
  ),
  cube: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9M8 5.3l8 4.4" />
    </>
  ),
  download: <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />,
  file: (
    <>
      <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8L14 3.5Z" />
      <path d="M14 3.5V8h4.5M9 12.5h6M9 16h4" />
    </>
  ),
  github: (
    <path d="M9.5 19.5c-4 1.2-4-2-5.6-2.4M15.3 21.5v-3.3a2.9 2.9 0 0 0-.8-2.2c2.7-.3 5.5-1.3 5.5-6a4.7 4.7 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.8 3.3 5.8 3.6 5.8 3.6a4.3 4.3 0 0 0-.1 3.2 4.7 4.7 0 0 0-1.3 3.2c0 4.6 2.8 5.7 5.5 6a2.9 2.9 0 0 0-.8 2.2v3.3" />
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5Z" />
    </>
  ),
  'grad-cap': (
    <>
      <path d="m12 5 9.5 4.5L12 14 2.5 9.5 12 5Z" />
      <path d="M6.5 11.5V16c1.5 1.6 3.4 2.4 5.5 2.4s4-.8 5.5-2.4v-4.5M21.5 9.5v5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  infinity: (
    <path d="M12 12c-1.9-2.6-3.6-4-5.5-4a4 4 0 0 0 0 8c1.9 0 3.6-1.4 5.5-4Zm0 0c1.9 2.6 3.6 4 5.5 4a4 4 0 0 0 0-8c-1.9 0-3.6 1.4-5.5 4Z" />
  ),
  layers: (
    <>
      <path d="m12 3.5 8.5 4.5L12 12.5 3.5 8 12 3.5Z" />
      <path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8 10.5V16.5M8 7.6v.01M11.5 16.5v-6M11.5 13c0-1.6 1-2.6 2.4-2.6s2.1 1 2.1 2.6v3.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </>
  ),
  menu: <path d="M4 7.5h16M4 12h16M4 16.5h10" />,
  network: (
    <>
      <circle cx="12" cy="5.5" r="2" />
      <circle cx="5.5" cy="18" r="2" />
      <circle cx="18.5" cy="18" r="2" />
      <path d="m11 7.3-4.5 8.9M13 7.3l4.5 8.9M7.5 18h9" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
  pulse: <path d="M3 12h4l2.5-6 4 12 2.5-6h5" />,
  rocket: (
    <>
      <path d="M13.5 15.5 8.5 10.5c1.8-4.6 5.6-7.3 11-7.5-.2 5.4-2.9 9.2-7.5 11Z" />
      <path d="M8.5 10.5 5 10l2.5-3.5h4M13.5 15.5l.5 3.5 3.5-2.5v-4M6.5 17.5c-1.2.5-2.3 1.5-3 3 1.5-.7 2.5-1.8 3-3Z" />
      <circle cx="15" cy="9" r="1.3" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16" />
    </>
  ),
  send: <path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z" />,
  shield: <path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-2.5Z" />,
  sliders: <path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4" />,
  sparkle: (
    <path d="M12 3.5c.6 4.3 2.7 6.4 7 7-4.3.6-6.4 2.7-7 7-.6-4.3-2.7-6.4-7-7 4.3-.6 6.4-2.7 7-7ZM18.5 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5Z" />
  ),
  stack: (
    <>
      <path d="M4 8.5 12 4l8 4.5-8 4.5-8-4.5Z" />
      <path d="m4 12.5 8 4.5 8-4.5" />
      <path d="m4 16 8 4.5 8-4.5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12h.01M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22" />
    </>
  ),
  captions: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M10.6 10.3a2.1 2.1 0 1 0 0 3.4M17 10.3a2.1 2.1 0 1 0 0 3.4" />
    </>
  ),
  collapse: (
    <path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4m11-5v3.5A1.5 1.5 0 0 0 16.5 9H20m0 6h-3.5a1.5 1.5 0 0 0-1.5 1.5V20M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20" />
  ),
  expand: (
    <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9m6 0h3.5A1.5 1.5 0 0 1 20 5.5V9m0 6v3.5a1.5 1.5 0 0 1-1.5 1.5H15m-6 0H5.5A1.5 1.5 0 0 1 4 18.5V15" />
  ),
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  replay: <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" />,
  volume: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" />
      <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.7a7.5 7.5 0 0 1 0 10.6" />
    </>
  ),
  'volume-off': (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" />
      <path d="m16 9.5 5 5m0-5-5 5" />
    </>
  ),
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  name: IconName;
  size?: number;
  title?: string;
}

export function Icon({ name, size = 20, title, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {paths[name]}
    </svg>
  );
}
