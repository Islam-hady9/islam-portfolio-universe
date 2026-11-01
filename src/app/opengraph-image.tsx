import { ImageResponse } from 'next/og';
import { getSite } from '@/content';

export const alt = 'Islam Abd-Elhady — AI Full-Stack Engineer · The Intelligence Universe';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Generated social card (original, brand-token based; no third-party imagery). */
export default function OpengraphImage() {
  const site = getSite();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px 84px',
          background:
            'radial-gradient(circle at 78% 42%, rgba(82,199,234,0.35) 0%, rgba(82,199,234,0.06) 22%, rgba(6,7,10,0) 42%), radial-gradient(circle at 92% 8%, rgba(139,124,255,0.25) 0%, rgba(6,7,10,0) 35%), #06070a',
          color: '#f3f5f5',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 20, letterSpacing: 10, color: '#aab4bc' }}>{site.portfolioIdentity}</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28, fontSize: 92, fontWeight: 700, lineHeight: 0.95 }}>
          {site.headlineLines.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
        <div style={{ display: 'flex', marginTop: 28, fontSize: 30, letterSpacing: 8, color: '#7ef7c9' }}>{site.roleLabel}</div>
        <div style={{ display: 'flex', marginTop: 22, fontSize: 30, color: '#f3f5f5' }}>{site.proposition}</div>
        <div
          style={{
            position: 'absolute',
            right: 90,
            top: 150,
            width: 330,
            height: 330,
            borderRadius: 330,
            border: '10px solid rgba(201,209,217,0.35)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 40,
            top: 255,
            width: 430,
            height: 120,
            borderRadius: 430,
            border: '6px solid rgba(126,247,201,0.45)',
            display: 'flex',
            transform: 'rotate(-20deg)',
          }}
        />
      </div>
    ),
    size,
  );
}
