import type { NextConfig } from 'next';

/**
 * Security headers applied to every route. Fonts are self-hosted, 3D is procedural and the
 * assistant runs in the browser: Smart Mode needs no third party at all.
 * 'unsafe-inline' for scripts is required by the tiny pre-paint boot script and Next's
 * inline hydration data; 'unsafe-eval' is NOT allowed.
 * Opt-in Local AI (docs/portfolio-intelligence-engine/SECURITY-AND-PRIVACY.md):
 * - 'wasm-unsafe-eval' lets the inference worker compile WebAssembly (no JavaScript eval);
 * - connect-src admits only the pinned model hosts: Hugging Face (weights, tokenizer, config,
 *   served from *.hf.co CDNs) and raw.githubusercontent.com (the compiled WebGPU library).
 *   Nothing is fetched from them before the visitor consents to the download.
 */
const MODEL_HOSTS = 'https://huggingface.co https://*.hf.co https://raw.githubusercontent.com';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'" +
        (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src 'self' ${MODEL_HOSTS}` + (process.env.NODE_ENV === 'development' ? ' ws:' : ''),
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev server only: Next 16 rejects dev requests (incl. the HMR socket) from hosts other than
  // `localhost`, which leaves the page un-hydrated — no 3D, no client interactivity — when it is
  // opened as http://127.0.0.1:3000. Add a LAN hostname here to test `next dev` from a phone.
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
