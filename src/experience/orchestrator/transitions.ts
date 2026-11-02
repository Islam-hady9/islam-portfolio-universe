/**
 * Transition requests from the DOM layer to the WebGL layer (spec §6.2: one owner per
 * animated property). The canvas registers handlers when mounted; with no canvas (static
 * tier, WebGL failure, reduced motion) requests complete immediately, so navigation never
 * depends on 3D.
 */

type Done = () => void;
type NodeApproachHandler = (nodeId: string, done: Done) => void;
type PortalHandler = (slug: string, source: HTMLElement, done: Done) => void;

let nodeApproach: NodeApproachHandler | null = null;
let portal: PortalHandler | null = null;

export function registerNodeApproach(handler: NodeApproachHandler | null) {
  nodeApproach = handler;
}

export function registerPortalTransition(handler: PortalHandler | null) {
  portal = handler;
}

/** Plays the camera approach toward a universe node, then calls `done` exactly once. */
export function requestNodeApproach(nodeId: string, done: Done) {
  let called = false;
  const once = () => {
    if (!called) {
      called = true;
      done();
    }
  };
  if (!nodeApproach) return once();
  // Hard ceiling: navigation must never be held hostage by an animation.
  const guard = window.setTimeout(once, 1400);
  nodeApproach(nodeId, () => {
    window.clearTimeout(guard);
    once();
  });
}

export function hasPortalTransition() {
  return portal !== null;
}

/** Expands a project card into its world, then calls `done` (route push) exactly once. */
export function requestPortalTransition(slug: string, source: HTMLElement, done: Done) {
  let called = false;
  const once = () => {
    if (!called) {
      called = true;
      done();
    }
  };
  if (!portal) return once();
  const guard = window.setTimeout(once, 1500);
  portal(slug, source, () => {
    window.clearTimeout(guard);
    once();
  });
}
