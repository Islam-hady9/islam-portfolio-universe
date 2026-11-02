import { Color, Vector3 } from 'three';

/**
 * Light the portal throws onto its surroundings, shared as uniform objects so the terrain that
 * receives it binds them at compile time and the ring updates them each frame — no extra
 * light (a light inside a gated group would recompile every lit material on visibility change).
 */
export const portalGlow = {
  /** Spill strength (presence × breathing × pulses); 0 when the station is out of view. */
  strength: { value: 0 },
  /** World position of the ring's base, where it meets the ground. */
  position: { value: new Vector3(0, -1e4, 0) },
  color: { value: new Color('#3fc4e6') },
};
