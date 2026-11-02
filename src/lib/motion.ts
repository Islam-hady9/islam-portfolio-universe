/**
 * Motion language (spec §6.4) shared by GSAP choreography, the WebGL transitions and — through
 * the matching custom properties in globals.css (--ease-*, --d-*) — CSS. One vocabulary:
 *   enter  : decisive deceleration (expo/power3 out) — things arriving settle quickly
 *   travel : symmetric in-out — camera and page travel, portal expansion
 *   commit : accelerating in — a choice being committed (node approach before navigating)
 * Durations are seconds (GSAP); CSS uses the same values in milliseconds.
 */
export const MOTION = {
  duration: {
    hover: 0.22, // --d-hover
    focus: 0.32, // --d-focus
    glow: 0.36, // --d-glow: surface light / border illumination
    fade: 0.42, // --d-fade: cross-fades and arrivals of panels
    lift: 0.52, // --d-lift: surface elevation and tilt return
    reveal: 0.82, // --d-reveal: blocks rising into place
    lines: 0.95, // masked headline lines
    commit: 0.72, // node approach before navigation
    settle: 1.1, // camera easing back after a commit
    portal: 0.82, // card → case-study expansion
    portalSettle: 0.6,
    travelMin: 0.9, // anchor travel, scaled by distance
    travelMax: 1.8,
  },
  ease: {
    enter: 'expo.out', // --ease-out cubic-bezier(0.16, 1, 0.3, 1)
    enterSoft: 'power3.out',
    travel: 'power3.inOut', // --ease-in-out cubic-bezier(0.65, 0, 0.35, 1)
    commit: 'power2.in',
    release: 'power2.out',
  },
  stagger: {
    lines: 0.07,
    items: 0.06,
  },
} as const;
