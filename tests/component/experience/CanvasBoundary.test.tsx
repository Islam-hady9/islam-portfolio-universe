import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasBoundary } from '@/experience/CanvasBoundary';
import { useExperience } from '@/state/experience-store';

function Broken(): never {
  // What three.js throws when the renderer is created on a lost context.
  throw new TypeError("null is not an object (evaluating 'e.getShaderPrecisionFormat(...).precision')");
}

afterEach(() => useExperience.setState({ webgl: 'pending' }));

describe('CanvasBoundary', () => {
  it('contains a renderer failure: nothing propagates, WebGL is marked failed', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const analytics = vi.fn();
    window.addEventListener('iu:analytics', analytics);
    render(
      <>
        <CanvasBoundary>
          <Broken />
        </CanvasBoundary>
        <p>page content</p>
      </>,
    );
    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(useExperience.getState().webgl).toBe('failed');
    expect((analytics.mock.calls[0]![0] as CustomEvent).detail.event).toBe('webgl_failure');
    window.removeEventListener('iu:analytics', analytics);
    quiet.mockRestore();
  });

  it('renders its children when nothing fails', () => {
    render(
      <CanvasBoundary>
        <p>canvas</p>
      </CanvasBoundary>,
    );
    expect(screen.getByText('canvas')).toBeInTheDocument();
  });
});
