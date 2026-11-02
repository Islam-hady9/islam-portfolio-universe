/**
 * Pre-paint boot script, inlined in <head>. Runs before first paint and before hydration:
 *  - marks JS availability,
 *  - resolves the effective motion preference (user override → system setting),
 *  - decides whether the S0 prelude plays (first session visit, desktop fine pointer,
 *    motion allowed, landing on "/" without a hash) — spec S0,
 *  - guarantees the prelude ends within 1.9 s (+0.5 s fade) even if the app bundle never loads.
 * Kept dependency-free and tiny; every storage access is guarded.
 */
const script = `(function(){try{
var d=document.documentElement;d.setAttribute('data-js','');
function g(s,k){try{return window[s].getItem(k)}catch(e){return null}}
function p(s,k,v){try{window[s].setItem(k,v)}catch(e){}}
var mm=function(q){return !!(window.matchMedia&&window.matchMedia(q).matches)};
var pref=g('localStorage','iu:motion');
var reduce=pref==='reduced'||(pref!=='full'&&mm('(prefers-reduced-motion: reduce)'));
d.setAttribute('data-motion',reduce?'reduced':'full');
var q=g('localStorage','iu:quality');if(q)d.setAttribute('data-quality-pref',q);
var play=!reduce&&!g('sessionStorage','iu:intro-seen')&&mm('(min-width: 1024px) and (pointer: fine)')&&location.pathname==='/'&&!location.hash&&!/[?&]intro=0/.test(location.search);
d.setAttribute('data-intro',play?'playing':'done');
if(play){p('sessionStorage','iu:intro-seen','1');d.setAttribute('data-intro-played','');window.__IU_INTRO_START=Date.now();
setTimeout(function(){if(d.getAttribute('data-intro')==='playing')d.setAttribute('data-intro','done')},1900);}
}catch(e){document.documentElement.setAttribute('data-intro','done')}})();`;

export const BOOT_SCRIPT = script;
