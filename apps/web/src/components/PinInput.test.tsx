import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PinInput } from './PinInput';

vi.mock('@sportykids/shared', () => ({
  t: (key: string) => key,
}));

describe('PinInput', () => {
  it('renders 4 password inputs', () => {
    render(<PinInput onSubmit={vi.fn()} title="Enter PIN" />);
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs).toHaveLength(4);
  });

  it('renders the title text', () => {
    render(<PinInput onSubmit={vi.fn()} title="Enter your PIN" />);
    expect(screen.getByText('Enter your PIN')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<PinInput onSubmit={vi.fn()} title="PIN" subtitle="4 digits" />);
    expect(screen.getByText('4 digits')).toBeInTheDocument();
  });

  it('calls onSubmit when all 4 digits are entered and button is clicked', () => {
    const onSubmit = vi.fn();
    render(<PinInput onSubmit={onSubmit} title="PIN" />);
    const inputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '2' } });
    fireEvent.change(inputs[2], { target: { value: '3' } });
    fireEvent.change(inputs[3], { target: { value: '4' } });

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledWith('1234');
  });

  it('disables submit button when PIN is incomplete', () => {
    render(<PinInput onSubmit={vi.fn()} title="PIN" />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('shows error message when provided', () => {
    render(<PinInput onSubmit={vi.fn()} title="PIN" error="Wrong PIN" />);
    expect(screen.getByText('Wrong PIN')).toBeInTheDocument();
  });
});
