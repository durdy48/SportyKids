import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminBadge } from './AdminBadge';

describe('AdminBadge', () => {
  it('renders label text', () => {
    render(<AdminBadge label="Pending" variant="yellow" />);
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('renders label prop as visible text (not children)', () => {
    render(<AdminBadge label="PASS" variant="green" />);
    expect(screen.getByText('PASS')).toBeTruthy();
  });

  it('applies green variant classes', () => {
    const { container } = render(<AdminBadge label="Approved" variant="green" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-green-900');
    expect(badge?.className).toContain('text-green-300');
  });

  it('applies red variant classes', () => {
    const { container } = render(<AdminBadge label="Rejected" variant="red" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-red-900');
    expect(badge?.className).toContain('text-red-300');
  });

  it('applies yellow variant classes', () => {
    const { container } = render(<AdminBadge label="Warning" variant="yellow" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-yellow-900');
  });

  it('applies gray variant classes', () => {
    const { container } = render(<AdminBadge label="Unknown" variant="gray" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-slate-700');
  });

  it('applies blue variant classes', () => {
    const { container } = render(<AdminBadge label="Info" variant="blue" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-blue-900');
  });

  it('applies purple variant classes', () => {
    const { container } = render(<AdminBadge label="Special" variant="purple" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-purple-900');
  });
});
