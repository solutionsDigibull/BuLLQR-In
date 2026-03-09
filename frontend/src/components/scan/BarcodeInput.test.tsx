import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import BarcodeInput from './BarcodeInput.tsx';

// BarcodeInput is a controlled component: value, onChange, onScan, disabled, error

describe('BarcodeInput', () => {
  it('renders with placeholder text', () => {
    render(
      <BarcodeInput value="" onChange={vi.fn()} onScan={vi.fn()} />,
    );
    expect(screen.getByPlaceholderText(/barcode/i)).toBeInTheDocument();
  });

  it('calls onScan when Enter is pressed with valid barcode (20+ chars)', async () => {
    const onScan = vi.fn();
    const validCode = 'WO-20260206-CABLE001-00001'; // 27 chars
    render(
      <BarcodeInput value={validCode} onChange={vi.fn()} onScan={onScan} />,
    );

    const input = screen.getByPlaceholderText(/barcode/i);
    await userEvent.type(input, '{Enter}');

    expect(onScan).toHaveBeenCalledWith(validCode);
  });

  it('does not call onScan for barcode shorter than 20 chars', async () => {
    const onScan = vi.fn();
    render(
      <BarcodeInput value="SHORT" onChange={vi.fn()} onScan={onScan} />,
    );

    const input = screen.getByPlaceholderText(/barcode/i);
    await userEvent.type(input, '{Enter}');

    expect(onScan).not.toHaveBeenCalled();
  });

  it('shows character count when value is present', () => {
    render(
      <BarcodeInput value="ABCDEFGHIJ" onChange={vi.fn()} onScan={vi.fn()} />,
    );

    expect(screen.getByText(/10.*chars/)).toBeInTheDocument();
  });

  it('shows min characters hint for short values', () => {
    render(
      <BarcodeInput value="SHORT" onChange={vi.fn()} onScan={vi.fn()} />,
    );

    expect(screen.getByText(/5\/20.*min/)).toBeInTheDocument();
  });

  it('disables input when disabled prop is true', () => {
    render(
      <BarcodeInput value="" onChange={vi.fn()} onScan={vi.fn()} disabled />,
    );

    expect(screen.getByPlaceholderText(/barcode/i)).toBeDisabled();
  });

  it('calls onChange when user types', async () => {
    const onChange = vi.fn();
    render(
      <BarcodeInput value="" onChange={onChange} onScan={vi.fn()} />,
    );

    const input = screen.getByPlaceholderText(/barcode/i);
    await userEvent.type(input, 'A');

    expect(onChange).toHaveBeenCalled();
  });

  it('shows error message when error prop is provided', () => {
    render(
      <BarcodeInput
        value=""
        onChange={vi.fn()}
        onScan={vi.fn()}
        error="Barcode not found"
      />,
    );

    expect(screen.getByText('Barcode not found')).toBeInTheDocument();
  });
});
