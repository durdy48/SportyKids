import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PinInput } from './PinInput';

vi.mock('@sportykids/shared', () => ({
  t: (key: string, _locale?: string, params?: Record<string, string>) => {
    if (key === 'a11y.parental.pin_digit' && params) {
      return `Digit ${params.n} of ${params.total}`;
    }
    return key;
  },
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

  describe('accessibility', () => {
    it('each digit input has an aria-label indicating its position', () => {
      render(<PinInput onSubmit={vi.fn()} title="PIN" />);
      expect(screen.getByLabelText('Digit 1 of 4')).toBeInTheDocument();
      expect(screen.getByLabelText('Digit 2 of 4')).toBeInTheDocument();
      expect(screen.getByLabelText('Digit 3 of 4')).toBeInTheDocument();
      expect(screen.getByLabelText('Digit 4 of 4')).toBeInTheDocument();
    });

    it('all digit inputs have type="password" for screen reader context', () => {
      render(<PinInput onSubmit={vi.fn()} title="PIN" />);
      const inputs = screen.getAllByLabelText(/Digit \d of 4/);
      inputs.forEach((input) => {
        expect(input).toHaveAttribute('type', 'password');
      });
    });
  });
});
