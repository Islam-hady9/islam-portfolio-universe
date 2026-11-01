import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SocialAction } from '@/components/contact/SocialAction';
import { getSocialLinks } from '@/content';
import type { SocialLink } from '@/content/schema';

const github = getSocialLinks().find((s) => s.id === 'github')!;
const linkedin = getSocialLinks().find((s) => s.id === 'linkedin')!;

describe('SocialAction with a configured URL', () => {
  it('fixtures: GitHub has a URL and LinkedIn does not', () => {
    expect(github.url).not.toBeNull();
    expect(linkedin.url).toBeNull();
  });

  it('renders an external link that opens in a new tab', () => {
    render(<SocialAction link={github} />);
    const link = screen.getByRole('link', { name: /GitHub/ });
    expect(link).toHaveAttribute('href', github.url!);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAccessibleName(/^GitHub\s?\(opens in a new tab\)$/);
    expect(link).toHaveAttribute('data-action', 'social-github');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('discloses to screen readers that an unverified link is pending confirmation', () => {
    render(<SocialAction link={github} />);
    expect(github.verification.status).toBe('placeholder');
    expect(screen.getByText('Link pending owner confirmation.')).toHaveClass('sr-only');
  });

  it('omits the pending note once the link is verified', () => {
    const verified: SocialLink = {
      ...github,
      verification: { ...github.verification, status: 'owner_verified' },
    };
    render(<SocialAction link={verified} />);
    expect(screen.getByRole('link', { name: /GitHub/ })).toBeInTheDocument();
    expect(screen.queryByText('Link pending owner confirmation.')).not.toBeInTheDocument();
  });
});

describe('SocialAction without a URL', () => {
  it('renders a collapsed disclosure button instead of a fake link', () => {
    render(<SocialAction link={linkedin} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: /LinkedIn/ });
    expect(button).toHaveTextContent('Soon');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('data-action', 'social-linkedin-unavailable');
  });

  it('controls a hidden note that holds the unavailable message', () => {
    const { container } = render(<SocialAction link={linkedin} />);
    const button = screen.getByRole('button', { name: /LinkedIn/ });
    const noteId = button.getAttribute('aria-controls');
    expect(noteId).toBeTruthy();
    const note = container.querySelector(`[id="${noteId}"]`);
    expect(note).toHaveTextContent(linkedin.unavailableMessage);
    expect(note).not.toBeVisible();
  });

  it('toggles the unavailable message on click', async () => {
    const user = userEvent.setup();
    render(<SocialAction link={linkedin} />);
    const button = screen.getByRole('button', { name: /LinkedIn/ });

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(linkedin.unavailableMessage);
    expect(screen.getByText(linkedin.unavailableMessage)).toBeVisible();

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(linkedin.unavailableMessage)).not.toBeVisible();
  });
});
