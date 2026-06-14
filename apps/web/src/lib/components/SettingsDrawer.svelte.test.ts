// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import SettingsDrawer from './SettingsDrawer.svelte';

// `open` is $bindable; without a parent binding the component still flips its own
// local copy on close, so we can assert open/close behavior with a plain prop.
describe('SettingsDrawer', () => {
  it('clicking the panel does not close; clicking the scrim closes', async () => {
    render(SettingsDrawer, { props: { open: true } });

    const dialog = screen.getByRole('dialog');
    await fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).not.toBeNull(); // still open

    const scrim = document.querySelector('.scrim')!;
    await fireEvent.click(scrim);
    expect(screen.queryByRole('dialog')).toBeNull(); // closed
  });

  it('Escape closes the drawer', async () => {
    render(SettingsDrawer, { props: { open: true } });
    const dialog = screen.getByRole('dialog');
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
