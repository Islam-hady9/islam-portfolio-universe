import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, ButtonLink } from '@/components/ui/Button';

describe('ButtonLink', () => {
  it('renders an internal route as a same-tab link', () => {
    render(<ButtonLink href="/projects">View projects</ButtonLink>);
    const link = screen.getByRole('link', { name: 'View projects' });
    expect(link).toHaveAttribute('href', '/projects');
    expect(link).not.toHaveAttribute('target');
    expect(link).not.toHaveAttribute('rel');
  });

  it('renders a home-anchor route', () => {
    render(<ButtonLink href="/#contact">Contact</ButtonLink>);
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/#contact');
  });

  it('renders a hash link as a native in-page anchor', () => {
    render(<ButtonLink href="#details">Details</ButtonLink>);
    const link = screen.getByRole('link', { name: 'Details' });
    expect(link).toHaveAttribute('href', '#details');
    expect(link).not.toHaveAttribute('target');
  });

  it('opens external links in a new tab safely and announces it', () => {
    render(
      <ButtonLink href="https://github.com/someone" external icon="github">
        GitHub
      </ButtonLink>,
    );
    // dom-accessibility-api trims the hint's leading space ("GitHub(opens…)"); browsers keep it.
    const link = screen.getByRole('link', { name: /^GitHub\s?\(opens in a new tab\)$/ });
    expect(link).toHaveAttribute('href', 'https://github.com/someone');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const hint = screen.getByText('(opens in a new tab)');
    expect(hint).toHaveClass('sr-only');
    expect(link).toContainElement(hint);
  });

  it('renders the badge text inside the link', () => {
    render(
      <ButtonLink href="/resume" badge="Soon">
        Download CV
      </ButtonLink>,
    );
    const link = screen.getByRole('link', { name: /Download CV/ });
    expect(link).toHaveTextContent('Download CVSoon');
    expect(screen.getByText('Soon')).toBeVisible();
  });

  it('maps describedBy to aria-describedby', () => {
    render(
      <>
        <ButtonLink href="/resume" describedBy="resume-note">
          Resume
        </ButtonLink>
        <p id="resume-note">Available after profile review</p>
      </>,
    );
    const link = screen.getByRole('link', { name: 'Resume' });
    expect(link).toHaveAttribute('aria-describedby', 'resume-note');
    expect(link).toHaveAccessibleDescription('Available after profile review');
  });

  it('exposes analytics and magnetic hooks only when asked', () => {
    const { rerender } = render(
      <ButtonLink href="/projects" dataAction="hero-projects" magnetic>
        Projects
      </ButtonLink>,
    );
    const link = screen.getByRole('link', { name: 'Projects' });
    expect(link).toHaveAttribute('data-action', 'hero-projects');
    expect(link).toHaveAttribute('data-magnetic', '');
    rerender(<ButtonLink href="/projects">Projects</ButtonLink>);
    expect(link).not.toHaveAttribute('data-magnetic');
    expect(link).not.toHaveAttribute('data-action');
    expect(link).not.toHaveAttribute('aria-describedby');
  });

  it('applies variant and size classes (secondary/md by default)', () => {
    const { rerender } = render(<ButtonLink href="/projects">Projects</ButtonLink>);
    expect(screen.getByRole('link')).toHaveClass('btn', 'secondary', 'md');
    rerender(
      <ButtonLink href="/projects" variant="primary" size="sm" className="extra">
        Projects
      </ButtonLink>,
    );
    expect(screen.getByRole('link')).toHaveClass('btn', 'primary', 'sm', 'extra');
  });

  it('keeps icons decorative', () => {
    const { container } = render(
      <ButtonLink href="/projects" icon="layers" trailingIcon="arrow-right">
        Projects
      </ButtonLink>,
    );
    const icons = container.querySelectorAll('svg');
    expect(icons).toHaveLength(2);
    icons.forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'));
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('is a type="button" by default and calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Toggle</Button>);
    const button = screen.getByRole('button', { name: 'Toggle' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.setup().click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick while disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Send
      </Button>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Send' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('maps the ARIA props', () => {
    render(
      <Button
        type="submit"
        ariaExpanded
        ariaControls="panel-1"
        ariaPressed={false}
        ariaLabel="Open panel"
        describedBy="hint"
      >
        Open
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Open panel' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', 'panel-1');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('aria-describedby', 'hint');
  });
});
