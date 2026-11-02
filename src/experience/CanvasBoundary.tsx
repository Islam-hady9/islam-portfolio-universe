'use client';

import { Component, type ReactNode } from 'react';
import { track } from '@/lib/analytics';
import { useExperience } from '@/state/experience-store';

/**
 * Contains WebGL failures inside the decorative 3D layer. The canvas lives in the root layout,
 * so an error thrown there (e.g. re-creating the renderer after the GPU process lost the
 * context: `getShaderPrecisionFormat` returns null) would otherwise reach the global error
 * boundary and replace the whole page. Here it marks WebGL as failed — the static posters
 * that already stand in for every scene stay up — and the page keeps working.
 */
export class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    track('webgl_failure', { where: 'canvas' });
    useExperience.getState().setWebGL('failed');
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
