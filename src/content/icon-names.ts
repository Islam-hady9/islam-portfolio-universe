/**
 * The closed set of icon identifiers content may reference. Kept free of React so the
 * content schema (used by build scripts and tests) can validate icon references.
 */
export const ICON_NAMES = [
  'arrow-left',
  'arrow-right',
  'arrow-up-right',
  'brain',
  'briefcase',
  'chart',
  'chat',
  'check',
  'chip',
  'close',
  'code',
  'compass',
  'cube',
  'download',
  'file',
  'github',
  'globe',
  'grad-cap',
  'info',
  'infinity',
  'layers',
  'linkedin',
  'lock',
  'mail',
  'menu',
  'network',
  'play',
  'pulse',
  'rocket',
  'route',
  'send',
  'shield',
  'sliders',
  'sparkle',
  'stack',
  'target',
] as const;

export type IconName = (typeof ICON_NAMES)[number];
