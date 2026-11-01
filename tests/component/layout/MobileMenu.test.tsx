import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileMenu } from '@/components/layout/MobileMenu';
import { PRIMARY_NAV, routes } from '@/lib/routes';

const ROLE_LABEL = 'AI FULL-STACK ENGINEER';

// Keep jsdom from attempting real navigations when links are clicked.
const blockNavigation = (e: MouseEvent) => e.preventDefault();
beforeEach(() => document.addEventListener('click', blockNavigation, true));
afterEach(() => {
  document.removeEventListener('click', blockNavigation, true);
  document.documentElement.style.overflow = '';
});

function renderMenu(props: {
  open: boolean;
  active?: string | null;
  onClose?: (restoreFocus: boolean) => void;
}) {
  const onClose = props.onClose ?? vi.fn();
  const ui = (open: boolean, close = onClose) => (
    <>
      <MobileMenu
        id="mobile-menu"
        open={open}
        active={props.active ?? null}
        roleLabel={ROLE_LABEL}
        onClose={close}
      />
      <main>Page content</main>
      <footer>Footer</footer>
    </>
  );
  const result = render(ui(props.open));
  return {
    ...result,
    onClose,
    rerenderOpen: (open: boolean, close?: (restoreFocus: boolean) => void) =>
      result.rerender(ui(open, close)),
  };
}

describe('MobileMenu when open', () => {
  it('renders the primary navigation plus contact and resume links', () => {
    renderMenu({ open: true });
    const region = screen.getByRole('region', { name: 'Site menu' });
    expect(region).toBeVisible();
    const nav = within(region).getByRole('navigation', { name: 'Mobile primary' });
    for (const item of PRIMARY_NAV) {
      expect(within(nav).getByRole('link', { name: item.label })).toHaveAttribute('href', item.href);
    }
    expect(within(nav).getByRole('link', { name: /Let.s Talk/ })).toHaveAttribute('href', routes.contact);
    expect(within(nav).getByRole('link', { name: 'Resume' })).toHaveAttribute('href', routes.resume);
    expect(within(nav).getByText(ROLE_LABEL)).toBeVisible();
  });

  it('marks only the active item as the current page', () => {
    renderMenu({ open: true, active: 'projects' });
    for (const item of PRIMARY_NAV) {
      const link = screen.getByRole('link', { name: item.label });
      if (item.id === 'projects') expect(link).toHaveAttribute('aria-current', 'page');
      else expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('moves focus to the first link', () => {
    renderMenu({ open: true });
    expect(screen.getByRole('link', { name: PRIMARY_NAV[0]!.label })).toHaveFocus();
  });

  it('closes with focus restoration when Escape is pressed', async () => {
    const { onClose } = renderMenu({ open: true });
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('uses the latest onClose callback without re-running the open effect', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerenderOpen } = renderMenu({ open: true, onClose: first });
    rerenderOpen(true, second);
    await userEvent.setup().keyboard('{Escape}');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(true);
  });

  it('closes without focus restoration when a link is followed', async () => {
    const { onClose } = renderMenu({ open: true });
    await userEvent.setup().click(screen.getByRole('link', { name: 'About' }));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('makes the rest of the page inert and locks scrolling until it closes', () => {
    const { rerenderOpen } = renderMenu({ open: true });
    const main = screen.getByRole('main', { hidden: true });
    const footer = document.querySelector('footer')!;
    expect(main).toHaveAttribute('inert');
    expect(footer).toHaveAttribute('inert');
    expect(document.documentElement.style.overflow).toBe('hidden');

    rerenderOpen(false);
    expect(main).not.toHaveAttribute('inert');
    expect(footer).not.toHaveAttribute('inert');
    expect(document.documentElement.style.overflow).toBe('');
  });
});

describe('MobileMenu when closed', () => {
  it('is hidden and exposes no navigation', () => {
    renderMenu({ open: false });
    const panel = document.getElementById('mobile-menu')!;
    expect(panel).toHaveAttribute('hidden');
    expect(panel).not.toBeVisible();
    expect(screen.queryByRole('region', { name: 'Site menu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('does not react to Escape or touch the page', async () => {
    const { onClose } = renderMenu({ open: false });
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('main')).not.toHaveAttribute('inert');
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('becomes visible when reopened', () => {
    const { rerenderOpen } = renderMenu({ open: false });
    rerenderOpen(true);
    expect(screen.getByRole('region', { name: 'Site menu' })).toBeVisible();
    expect(screen.getByRole('link', { name: PRIMARY_NAV[0]!.label })).toHaveFocus();
  });
});
