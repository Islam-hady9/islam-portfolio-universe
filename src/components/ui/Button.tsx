import Link from 'next/link';
import type { ReactNode } from 'react';
import type { IconName } from '@/content/icon-names';
import { Icon } from './Icon';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'sm';

interface CommonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  trailingIcon?: IconName;
  /** Small status pill rendered inside the button (e.g. "Soon"). */
  badge?: string;
  /** id of an element describing deferred/unavailable status. */
  describedBy?: string;
  magnetic?: boolean;
  className?: string;
  /** Analytics/test hook. */
  dataAction?: string;
}

function Inner({
  children,
  icon,
  trailingIcon,
  badge,
}: Pick<CommonProps, 'children' | 'icon' | 'trailingIcon' | 'badge'>) {
  return (
    <span className={styles.inner} data-magnetic-inner="">
      {icon ? <Icon name={icon} size={18} className={styles.icon} /> : null}
      <span className={styles.label}>{children}</span>
      {badge ? <span className={styles.badge}>{badge}</span> : null}
      {trailingIcon ? <Icon name={trailingIcon} size={16} className={styles.trailing} /> : null}
    </span>
  );
}

export interface ButtonLinkProps extends CommonProps {
  href: string;
  external?: boolean;
  /** Same-origin file download: renders a native <a download> with this suggested file name. */
  download?: string;
}

/** A link styled as a button. Internal routes use next/link; hash links stay native anchors. */
export function ButtonLink({
  href,
  external,
  download,
  variant = 'secondary',
  size = 'md',
  magnetic,
  className,
  describedBy,
  dataAction,
  ...inner
}: ButtonLinkProps) {
  const cls = [styles.btn, styles[variant], styles[size], className].filter(Boolean).join(' ');
  const shared = {
    className: cls,
    'data-magnetic': magnetic ? '' : undefined,
    'aria-describedby': describedBy,
    'data-action': dataAction,
  };
  if (download) {
    return (
      <a href={href} download={download} {...shared}>
        <Inner {...inner} />
      </a>
    );
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...shared}>
        <Inner {...inner} />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  if (href.startsWith('#')) {
    return (
      <a href={href} {...shared}>
        <Inner {...inner} />
      </a>
    );
  }
  return (
    <Link href={href} {...shared}>
      <Inner {...inner} />
    </Link>
  );
}

export interface ButtonProps extends CommonProps {
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
  ariaPressed?: boolean;
  ariaLabel?: string;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  magnetic,
  className,
  onClick,
  type = 'button',
  disabled,
  describedBy,
  ariaExpanded,
  ariaControls,
  ariaPressed,
  ariaLabel,
  dataAction,
  ...inner
}: ButtonProps) {
  const cls = [styles.btn, styles[variant], styles[size], className].filter(Boolean).join(' ');
  return (
    <button
      type={type}
      className={cls}
      onClick={onClick}
      disabled={disabled}
      aria-describedby={describedBy}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-pressed={ariaPressed}
      aria-label={ariaLabel}
      data-magnetic={magnetic ? '' : undefined}
      data-action={dataAction}
    >
      <Inner {...inner} />
    </button>
  );
}
