'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  evaluatePath,
  GROUND_CLEARANCE,
  GROUND_LAYERS,
  groundLayerVisible,
  HOME_STATIONS,
  type Pose,
} from '../orchestrator/camera-path';
import { frame } from '../orchestrator/frame-state';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Deep-space framing for inner pages: slow vertical drift with page scroll. */
function innerPose(scrollY: number, aspect: 'wide' | 'portrait'): Pose {
  const drift = scrollY * 0.0016;
  return {
    position: [0, 2 - drift, aspect === 'wide' ? 14 : 18],
    target: [0, 1.2 - drift, 0],
    fov: aspect === 'wide' ? 36 : 44,
    lens: [aspect === 'wide' ? 0.16 : 0, aspect === 'wide' ? 0 : 0.1],
  };
}

/**
 * Unified camera rig (spec §6.3). Owns the camera exclusively:
 *   path pose (damped s) → local drift → intro dolly → node approach blend → pointer parallax
 * then applies FOV and lens shift (setViewOffset) so subjects sit beside the DOM copy without
 * perspective distortion. Roll is always 0.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const tmp = useMemo(
    () => ({
      pos: new Vector3(),
      target: new Vector3(),
      dir: new Vector3(),
      up: new Vector3(0, 1, 0),
      right: new Vector3(),
    }),
    [],
  );

  useFrame(() => {
    const pose =
      frame.route === 'home'
        ? evaluatePath(HOME_STATIONS, frame.s, frame.aspect)
        : innerPose(frame.scrollY, frame.aspect);
    tmp.pos.set(pose.position[0], pose.position[1], pose.position[2]);
    tmp.target.set(pose.target[0], pose.target[1], pose.target[2]);

    if (frame.route === 'home' && !frame.reduced) {
      // Local drift: shallow dolly / lateral parallax while a section is read.
      for (let i = 0; i < HOME_STATIONS.length; i++) {
        const p = frame.presence[i] ?? 0;
        if (p <= 0) continue;
        const d = HOME_STATIONS[i]!.drift;
        const u = (frame.local[i] ?? 0) * p;
        tmp.pos.x += d[0] * u;
        tmp.pos.y += d[1] * u;
        tmp.pos.z += d[2] * u;
        tmp.target.x += d[0] * u * 0.6;
      }
      // Intro: establishing dolly from depth toward the core (spec S1, 1.2–2.0 s).
      const heroP = frame.presence[0] ?? 0;
      if (heroP > 0 && frame.intro < 1) {
        const k = 1 - easeOutCubic(frame.intro);
        tmp.pos.z += 9.5 * k * heroP;
        tmp.pos.y += 1.4 * k * heroP;
        tmp.pos.x -= 1.2 * k * heroP;
      }
    }

    // Universe node approach (controlled dive toward the selected destination).
    const w = frame.approach.weight;
    if (w > 0.0001) {
      tmp.dir.set(frame.approach.x, frame.approach.y, frame.approach.z);
      const toNode = tmp.dir.clone().sub(tmp.pos);
      const dist = toNode.length();
      const stop = tmp.pos.clone().add(toNode.multiplyScalar(Math.max(0, (dist - 3.2) / dist)));
      tmp.pos.lerp(stop, w);
      tmp.target.lerp(tmp.dir, w * 0.85);
    }

    // Pointer parallax: orbit the target by ≤ 3° yaw / 2° pitch, damped (spec S1).
    const baseY = tmp.pos.y;
    const yaw = frame.pointer.sx * 0.052;
    const pitch = frame.pointer.sy * 0.035;
    if (yaw !== 0 || pitch !== 0) {
      tmp.dir.copy(tmp.pos).sub(tmp.target);
      tmp.dir.applyAxisAngle(tmp.up, -yaw);
      tmp.right.crossVectors(tmp.up, tmp.dir).normalize();
      tmp.dir.applyAxisAngle(tmp.right, pitch);
      tmp.pos.copy(tmp.target).add(tmp.dir);
    }

    // Ground guard: parallax never orbits the camera into a visible ground layer (identity rests
    // 0.4 above the hero terrain; a full 2° pitch would sink it ~0.8 and open a hole in the ground).
    if (frame.route === 'home') {
      for (const layer of GROUND_LAYERS) {
        if (!groundLayerVisible(layer.id, frame.s, frame.aspect)) continue;
        const maxDrop = Math.max(0, baseY - (layer.ground + GROUND_CLEARANCE));
        if (baseY - tmp.pos.y > maxDrop) tmp.pos.y = baseY - maxDrop;
      }
    }

    camera.position.copy(tmp.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(tmp.target);
    if (Math.abs(camera.fov - pose.fov) > 0.001) camera.fov = pose.fov;
    const width = size.width;
    const height = size.height;
    camera.setViewOffset(width, height, -pose.lens[0] * width, pose.lens[1] * height, width, height);
  }, -1);

  return null;
}
