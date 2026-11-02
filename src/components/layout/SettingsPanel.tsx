'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useExperience, type MotionPreference } from '@/state/experience-store';
import { applyMotionPreference, applyQualityPreference } from '@/lib/preferences';
import type { QualityPreference, QualityTier } from '@/experience/quality/tiers';
import styles from './SettingsPanel.module.css';

const TIER_LABEL: Record<QualityTier, string> = {
  ultra: 'Cinematic',
  balanced: 'Balanced',
  lite: 'Lite',
  static: 'Static',
};

const QUALITY_OPTIONS: { value: QualityPreference; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Adapts to this device' },
  { value: 'ultra', label: 'Cinematic', hint: 'Full 3D, bloom, particles' },
  { value: 'balanced', label: 'Balanced', hint: 'Fewer particles, lower resolution' },
  { value: 'lite', label: 'Lite', hint: 'Simplified 3D, no post-processing' },
  { value: 'static', label: 'Static', hint: 'No WebGL — still images' },
];

const MOTION_OPTIONS: { value: MotionPreference; label: string }[] = [
  { value: 'system', label: 'Follow system' },
  { value: 'reduced', label: 'Reduce motion' },
  { value: 'full', label: 'Full motion' },
];

interface SettingsPanelProps {
  id: string;
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLButtonElement | null>;
}

export function SettingsPanel({ id, open, onClose, anchorRef }: SettingsPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const qualityPreference = useExperience((s) => s.qualityPreference);
  const tier = useExperience((s) => s.tier);
  const detectedTier = useExperience((s) => s.detectedTier);
  const tierReason = useExperience((s) => s.tierReason);
  const motionPreference = useExperience((s) => s.motionPreference);
  const reducedMotion = useExperience((s) => s.reducedMotion);
  const webgl = useExperience((s) => s.webgl);

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchorRef.current?.contains(t)) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, anchorRef]);

  const webglLabel =
    webgl === 'ready'
      ? '3D active'
      : webgl === 'pending'
        ? '3D loading'
        : webgl === 'disabled'
          ? '3D off'
          : webgl === 'lost'
            ? '3D recovering'
            : '3D unavailable';

  return (
    <div
      id={id}
      ref={ref}
      className={`${styles.panel} glass glass--panel glass--mint`}
      hidden={!open}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-title`}
    >
      <p id={`${id}-title`} className={styles.title}>
        Experience settings
      </p>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Visual quality</legend>
        {QUALITY_OPTIONS.map((o) => (
          <label key={o.value} className={styles.option}>
            <input
              type="radio"
              name={`${id}-quality`}
              value={o.value}
              checked={qualityPreference === o.value}
              onChange={() => applyQualityPreference(o.value)}
            />
            <span className={styles.optionText}>
              <span className={styles.optionLabel}>
                {o.label}
                {o.value === 'auto' && detectedTier ? (
                  <span className={styles.detected}> · {TIER_LABEL[detectedTier]}</span>
                ) : null}
              </span>
              <span className={styles.optionHint}>{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Motion</legend>
        {MOTION_OPTIONS.map((o) => (
          <label key={o.value} className={styles.option}>
            <input
              type="radio"
              name={`${id}-motion`}
              value={o.value}
              checked={motionPreference === o.value}
              onChange={() => applyMotionPreference(o.value)}
            />
            <span className={styles.optionLabel}>{o.label}</span>
          </label>
        ))}
      </fieldset>
      <p className={styles.status} aria-live="polite" data-testid="quality-status">
        <span>{TIER_LABEL[tier]}</span>
        <span aria-hidden="true">·</span>
        <span>{webglLabel}</span>
        <span aria-hidden="true">·</span>
        <span>{reducedMotion ? 'Reduced motion' : 'Full motion'}</span>
      </p>
      <p className={styles.reason}>Auto-detection: {tierReason}</p>
    </div>
  );
}
