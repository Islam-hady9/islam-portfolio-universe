import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { ribbonGeometry } from '@/experience/portals/worlds/kit';

describe('ribbonGeometry (V3 line quality)', () => {
  const camera = new Vector3(0, 1, 8);
  const paths = [
    Array.from({ length: 9 }, (_, i) => new Vector3(-4 + i, Math.sin(i * 0.6), -2)),
    Array.from({ length: 5 }, (_, i) => new Vector3(i * 0.5, 0, -3 - i)),
  ];
  const g = ribbonGeometry(paths, camera);

  it('emits two vertices per path point and two triangles per segment', () => {
    expect(g.attributes.position!.count).toBe((9 + 5) * 2);
    expect(g.index!.count).toBe((9 - 1 + (5 - 1)) * 6);
  });

  it('keeps vertices on the centreline; the shader widens them along a unit side vector', () => {
    const pos = g.attributes.position!;
    const side = g.attributes.aSide!;
    const across = g.attributes.aAcross!;
    for (let i = 0; i < pos.count; i += 2) {
      expect(pos.getX(i)).toBe(pos.getX(i + 1));
      expect(across.getX(i)).toBe(-1);
      expect(across.getX(i + 1)).toBe(1);
      expect(Math.hypot(side.getX(i), side.getY(i), side.getZ(i))).toBeCloseTo(1, 5);
    }
  });

  it('orients each strip toward the camera (side ⟂ tangent and ⟂ view direction)', () => {
    const pos = g.attributes.position!;
    const side = g.attributes.aSide!;
    for (let i = 2; i < 16; i += 2) {
      const p = new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      const s = new Vector3(side.getX(i), side.getY(i), side.getZ(i));
      const view = camera.clone().sub(p).normalize();
      expect(Math.abs(s.dot(view))).toBeLessThan(1e-6);
    }
  });

  it('runs aT from 0 to 1 along each path and labels lanes', () => {
    const t = g.attributes.aT!;
    const lane = g.attributes.aLane!;
    expect(t.getX(0)).toBe(0);
    expect(t.getX(9 * 2 - 1)).toBe(1);
    expect(lane.getX(9 * 2)).toBe(1);
  });
});
