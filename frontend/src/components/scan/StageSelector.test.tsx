import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import StageSelector from './StageSelector.tsx';
import type { ProductionStage } from '../../types/scan.ts';

// StageSelector props: stages, selectedStageId, onChange, disabled, loading

const MOCK_STAGES: ProductionStage[] = [
  { id: 'stage-1', stage_name: 'Cutting', stage_sequence: 1, description: null },
  { id: 'stage-2', stage_name: 'Stripping', stage_sequence: 2, description: null },
  { id: 'stage-3', stage_name: 'Crimping', stage_sequence: 3, description: null },
];

describe('StageSelector', () => {
  it('renders a select element with stage options', () => {
    render(
      <StageSelector
        stages={MOCK_STAGES}
        selectedStageId=""
        onChange={vi.fn()}
      />,
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText(/Cutting/)).toBeInTheDocument();
    expect(screen.getByText(/Stripping/)).toBeInTheDocument();
    expect(screen.getByText(/Crimping/)).toBeInTheDocument();
  });

  it('calls onChange when a stage is chosen', async () => {
    const onChange = vi.fn();
    render(
      <StageSelector
        stages={MOCK_STAGES}
        selectedStageId=""
        onChange={onChange}
      />,
    );

    await userEvent.selectOptions(screen.getByRole('combobox'), 'stage-2');
    expect(onChange).toHaveBeenCalled();
  });

  it('shows loading text when loading', () => {
    render(
      <StageSelector
        stages={[]}
        selectedStageId=""
        onChange={vi.fn()}
        loading
      />,
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows placeholder option when no stage is selected', () => {
    render(
      <StageSelector
        stages={MOCK_STAGES}
        selectedStageId=""
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/select a stage/i)).toBeInTheDocument();
  });

  it('sets the selected stage correctly', () => {
    render(
      <StageSelector
        stages={MOCK_STAGES}
        selectedStageId="stage-2"
        onChange={vi.fn()}
      />,
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('stage-2');
  });
});
