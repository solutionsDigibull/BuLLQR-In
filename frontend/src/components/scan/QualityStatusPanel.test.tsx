import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import QualityStatusPanel from './QualityStatusPanel.tsx';

// QualityStatusPanel props: mode ('normal'|'update'), onSelect, disabled

describe('QualityStatusPanel', () => {
  it('renders OK and NOT OK buttons in normal mode', () => {
    render(<QualityStatusPanel mode="normal" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'NOT OK' })).toBeInTheDocument();
  });

  it('calls onSelect with "ok" when OK is clicked', async () => {
    const onSelect = vi.fn();
    render(<QualityStatusPanel mode="normal" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onSelect).toHaveBeenCalledWith('ok');
  });

  it('calls onSelect with "not_ok" when NOT OK is clicked', async () => {
    const onSelect = vi.fn();
    render(<QualityStatusPanel mode="normal" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'NOT OK' }));
    expect(onSelect).toHaveBeenCalledWith('not_ok');
  });

  it('renders update mode buttons when mode is update', () => {
    render(<QualityStatusPanel mode="update" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'OK UPDATE' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'NOT OK UPDATE' })).toBeInTheDocument();
  });

  it('calls onSelect with "ok_update" in update mode', async () => {
    const onSelect = vi.fn();
    render(<QualityStatusPanel mode="update" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'OK UPDATE' }));
    expect(onSelect).toHaveBeenCalledWith('ok_update');
  });

  it('calls onSelect with "not_ok_update" in update mode', async () => {
    const onSelect = vi.fn();
    render(<QualityStatusPanel mode="update" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'NOT OK UPDATE' }));
    expect(onSelect).toHaveBeenCalledWith('not_ok_update');
  });

  it('disables buttons when disabled prop is true', () => {
    render(<QualityStatusPanel mode="normal" onSelect={vi.fn()} disabled />);

    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'NOT OK' })).toBeDisabled();
  });
});
