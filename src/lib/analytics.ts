/**
 * Privacy-aware analytics stub (spec §8.3). Emits high-level events only, never chat input
 * or personal identifiers, and sends NOTHING over the network. Events are dispatched as a
 * DOM CustomEvent ("iu:analytics") so a future, owner-approved provider can subscribe in
 * one place; in development they are logged for QA.
 */
export type AnalyticsEvent =
  | 'hero_cta_click'
  | 'project_open'
  | 'resume_request'
  | 'contact_click'
  | 'universe_node_select'
  | 'quality_tier'
  | 'webgl_context_lost'
  | 'webgl_failure'
  | 'scene_error'
  | 'assistant_demo_query';

export function track(event: AnalyticsEvent, props: Record<string, string | number | boolean> = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('iu:analytics', { detail: { event, props, t: Date.now() } }));
  if (process.env.NODE_ENV === 'development') console.debug('[analytics]', event, props);
}
