import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedModeToggle } from './FeedModeToggle';
// FeedMode type tested implicitly through component props

vi.mock('@sportykids/shared', () => ({
  t: (key: string) => key,
}));

describe('FeedModeToggle', () => {
  it('renders all three mode buttons', () => {
    const onChange = vi.fn();
    render(<FeedModeToggle mode="cards" onChange={onChange} locale="es" />);
    expect(screen.getByText('feed.mode_headlines')).toBeInTheDocument();
    expect(screen.getByText('feed.mode_cards')).toBeInTheDocument();
    expect(screen.getByText('feed.mode_explain')).toBeInTheDocument();
  });

  it('calls onChange with the correct mode when a button is clicked', () => {
    const onChange = vi.fn();
    render(<FeedModeToggle mode="cards" onChange={onChange} locale="es" />);
    fireEvent.click(screen.getByText('feed.mode_headlines'));
    expect(onChange).toHaveBeenCalledWith('headlines');
  });

  it('applies active styles to the current mode', () => {
    const onChange = vi.fn();
    const { container } = render(<FeedModeToggle mode="explain" onChange={onChange} locale="es" />);
    const buttons = container.querySelectorAll('button');
    // The explain button (3rd) should have the active class with shadow-sm
    expect(buttons[2].className).toContain('shadow-sm');
    // The cards button (2nd) should not
    expect(buttons[1].className).not.toContain('shadow-sm');
  });
});
