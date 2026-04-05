import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminMetricCard } from './AdminMetricCard';

describe('AdminMetricCard', () => {
  it('renders title and value', () => {
    render(<AdminMetricCard title="Pending Items" value={42} />);
    expect(screen.getByText('Pending Items')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders string value', () => {
    render(<AdminMetricCard title="Status" value="Active" />);
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('renders trend with positive value', () => {
    render(
      <AdminMetricCard
        title="News Approved"
        value={100}
        trend={{ value: 15, label: 'vs last week' }}
      />,
    );
    expect(screen.getByText(/15%/)).toBeTruthy();
    expect(screen.getByText(/vs last week/)).toBeTruthy();
  });

  it('renders trend with negative value', () => {
    render(
      <AdminMetricCard
        title="Rejections"
        value={5}
        trend={{ value: -10, label: 'vs last week' }}
      />,
    );
    expect(screen.getByText(/10%/)).toBeTruthy();
  });

  it('applies warning border for severity=warning', () => {
    const { container } = render(
      <AdminMetricCard title="Warnings" value={3} severity="warning" />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card?.className).toContain('border-yellow-800');
  });

  it('applies error border for severity=error', () => {
    const { container } = render(
      <AdminMetricCard title="Errors" value={99} severity="error" />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card?.className).toContain('border-red-800');
  });

  it('uses default normal border when severity not specified', () => {
    const { container } = render(
      <AdminMetricCard title="Normal" value={0} />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card?.className).toContain('border-slate-800');
  });

  it('renders icon when provided', () => {
    render(
      <AdminMetricCard title="With Icon" value={10} icon={<span data-testid="icon">★</span>} />,
    );
    expect(screen.getByTestId('icon')).toBeTruthy();
  });
});
