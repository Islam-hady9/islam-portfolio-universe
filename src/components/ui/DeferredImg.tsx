'use client';

import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { afterFirstPaint } from '@/lib/after-load';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'loading' | 'alt'> & {
  src: string;
  srcSet?: string;
  /** Modern-format candidates (AVIF/WebP) rendered as <picture> sources ahead of `src`. */
  sources?: readonly { type: string; srcSet: string }[];
  /** Required: '' for purely decorative art. */
  alt: string;
};

/**
 * Below-the-fold image whose request starts only after first paint, so it never competes
 * with the LCP image for bandwidth on slow connections. Alt text, intrinsic size and position
 * are present from the server HTML (no layout shift); the image fades in once loaded.
 * Without JavaScript the <noscript> copy is used.
 */
export function DeferredImg({ src, srcSet, sources, sizes, alt, className, style, ...rest }: Props) {
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    void afterFirstPaint(3000).then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- pre-optimised asset with its own responsive variants
    <img
      {...rest}
      alt={alt}
      className={className}
      src={ready ? src : undefined}
      srcSet={ready ? srcSet : undefined}
      sizes={sizes}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      style={{ ...style, opacity: loaded ? undefined : 0, transition: 'opacity 600ms ease' }}
    />
  );
  return (
    <>
      {sources?.length ? (
        <picture>
          {/* Candidates appear only once ready: a <source> without srcset is skipped. */}
          {ready
            ? sources.map((s) => <source key={s.type} type={s.type} srcSet={s.srcSet} sizes={sizes} />)
            : null}
          {img}
        </picture>
      ) : (
        img
      )}
      <noscript>
        {sources?.length ? (
          <picture>
            {sources.map((s) => (
              <source key={s.type} type={s.type} srcSet={s.srcSet} sizes={sizes} />
            ))}
            <img
              {...rest}
              alt={alt}
              className={className}
              src={src}
              srcSet={srcSet}
              sizes={sizes}
              style={style}
            />
          </picture>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- no-JS fallback copy
          <img
            {...rest}
            alt={alt}
            className={className}
            src={src}
            srcSet={srcSet}
            sizes={sizes}
            loading="lazy"
            style={style}
          />
        )}
      </noscript>
    </>
  );
}
