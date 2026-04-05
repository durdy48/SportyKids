import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminTable, type Column } from './AdminTable';

type TestRow = Record<string, unknown> & { id: string; name: string; sport: string };

const columns: Column<TestRow>[] = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name', sortable: true },
  { key: 'sport', header: 'Sport' },
];

const sampleData: TestRow[] = [
  { id: '1', name: 'Football News', sport: 'football' },
  { id: '2', name: 'Tennis Reel', sport: 'tennis' },
];

describe('AdminTable', () => {
  it('renders column headers', () => {
    render(
      <AdminTable
        columns={columns}
        data={sampleData}
        loading={false}
        page={1}
        totalPages={1}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByText('ID')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Sport')).toBeTruthy();
  });

  it('renders data rows', () => {
    render(
      <AdminTable
        columns={columns}
        data={sampleData}
        loading={false}
        page={1}
        totalPages={1}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Football News')).toBeTruthy();
    expect(screen.getByText('Tennis Reel')).toBeTruthy();
  });

  it('shows empty message when data is empty', () => {
    render(
      <AdminTable
        columns={columns}
        data={[]}
        loading={false}
        page={1}
        totalPages={1}
        onPageChange={vi.fn()}
        emptyMessage="Nothing here."
      />,
    );
    expect(screen.getByText('Nothing here.')).toBeTruthy();
  });

  it('shows loading skeleton rows when loading=true', () => {
    const { container } = render(
      <AdminTable
        columns={columns}
        data={[]}
        loading={true}
        page={1}
        totalPages={1}
        onPageChange={vi.fn()}
      />,
    );
    // 3 skeleton rows should be rendered
    const skeletonRows = container.querySelectorAll('tr.animate-pulse');
    expect(skeletonRows.length).toBe(3);
  });

  it('does not show pagination when totalPages <= 1', () => {
    const { queryByText } = render(
      <AdminTable
        columns={columns}
        data={sampleData}
        loading={false}
        page={1}
        totalPages={1}
        onPageChange={vi.fn()}
      />,
    );
    expect(queryByText('Previous')).toBeNull();
  });

  it('shows pagination when totalPages > 1', () => {
    render(
      <AdminTable
        columns={columns}
        data={sampleData}
        loading={false}
        page={1}
        totalPages={3}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Previous')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
  });

  it('calls onPageChange with next page when Next is clicked', () => {
    const onPageChange = vi.fn();
    render(
      <AdminTable
        columns={columns}
        data={sampleData}
        loading={false}
        page={2}
        totalPages={5}
        onPageChange={onPageChange}
      />,
    );
    fireEvent.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageChange with prev page when Previous is clicked', () => {
    const onPageChange = vi.fn();
    render(
      <AdminTable
        columns={columns}
        data={sampleData}
        loading={false}
        page={3}
        totalPages={5}
        onPageChange={onPageChange}
      />,
    );
    fireEvent.click(screen.getByText('Previous'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onSort when a sortable column header is clicked', () => {
    const onSort = vi.fn();
    render(
      <AdminTable
        columns={columns}
        data={sampleData}
        loading={false}
        page={1}
        totalPages={1}
        onPageChange={vi.fn()}
        onSort={onSort}
      />,
    );
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name', 'asc');
  });

  it('uses custom render function for columns', () => {
    const customColumns: Column<TestRow>[] = [
      {
        key: 'name',
        header: 'Name',
        render: (row) => <span data-testid="custom">{row.name.toUpperCase()}</span>,
      },
    ];
    render(
      <AdminTable
        columns={customColumns}
        data={[{ id: '1', name: 'hello', sport: 'tennis' }]}
        loading={false}
        page={1}
        totalPages={1}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('custom').textContent).toBe('HELLO');
  });
});
