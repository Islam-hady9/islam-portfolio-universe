import type { UniverseNode } from '@/content/schema';

export type NodeId = UniverseNode['id'];
export type LabelPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface NodeLayout {
  /** Angle on the galaxy plane, degrees, counter-clockwise from +X. */
  angle: number;
  /** Orbit radius in world units. */
  radius: number;
  /** Small vertical offset off the plane for depth variety. */
  lift: number;
  placement: LabelPlacement;
  /** Fallback position (percent of the stage box) when the live 3D projection is unavailable. */
  staticPos: [number, number];
}

/**
 * Composition follows the approved reference: AI Systems upper-left, Products top,
 * Case Studies right, Contact lower-right, Stack bottom, Experience left.
 */
export const UNIVERSE_LAYOUT: Record<NodeId, NodeLayout> = {
  'ai-systems': { angle: 128, radius: 5.4, lift: 0.25, placement: 'top', staticPos: [24, 24] },
  products: { angle: 68, radius: 6.3, lift: 0.35, placement: 'top', staticPos: [61, 13] },
  'case-studies': { angle: 12, radius: 7.1, lift: 0.15, placement: 'top', staticPos: [88, 36] },
  contact: { angle: -42, radius: 6.1, lift: -0.1, placement: 'bottom', staticPos: [79, 77] },
  stack: { angle: -98, radius: 5.0, lift: -0.2, placement: 'bottom', staticPos: [50, 88] },
  experience: { angle: 196, radius: 6.2, lift: 0.0, placement: 'bottom', staticPos: [15, 66] },
};

export const ORBIT_TRACKS = [4.6, 5.4, 6.2, 7.1];
