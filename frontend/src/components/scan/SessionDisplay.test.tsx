import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SessionDisplay from './SessionDisplay.tsx';
import type { ScanRecord } from '../../types/scan.ts';

// SessionDisplay props: scans, highlightIds?: Set<string>

const MOCK_SCANS: ScanRecord[] = [
  {
    id: 'scan-1',
    work_order_id: 'wo-1',
    work_order_code: 'WO-20260206-CABLE001-00001',
    serial_number: '#00001',
    stage_id: 'stage-1',
    stage_name: 'Cutting',
    operator_id: 'op-1',
    operator_name: 'John Doe',
    station_id: 'WS-01',
    scan_type: 'normal',
    quality_status: 'ok',
    is_first_article: false,
    quality_inspector_id: null,
    quality_inspector_name: null,
    previous_quality_status: null,
    scan_timestamp: '2026-02-06T10:30:00Z',
    created_at: '2026-02-06T10:30:00Z',
  },
  {
    id: 'scan-2',
    work_order_id: 'wo-2',
    work_order_code: 'WO-20260206-CABLE001-00002',
    serial_number: '#00002',
    stage_id: 'stage-3',
    stage_name: 'Crimping',
    operator_id: 'op-1',
    operator_name: 'John Doe',
    station_id: 'WS-01',
    scan_type: 'normal',
    quality_status: 'not_ok',
    is_first_article: false,
    quality_inspector_id: null,
    quality_inspector_name: null,
    previous_quality_status: null,
    scan_timestamp: '2026-02-06T10:25:00Z',
    created_at: '2026-02-06T10:25:00Z',
  },
  {
    id: 'scan-3',
    work_order_id: 'wo-3',
    work_order_code: 'WO-20260206-CABLE001-00003',
    serial_number: '#00003',
    stage_id: 'stage-1',
    stage_name: 'Cutting',
    operator_id: 'op-2',
    operator_name: 'Jane Smith',
    station_id: 'WS-02',
    scan_type: 'first_article',
    quality_status: 'ok',
    is_first_article: true,
    quality_inspector_id: 'qi-1',
    quality_inspector_name: 'QI Inspector',
    previous_quality_status: null,
    scan_timestamp: '2026-02-06T10:20:00Z',
    created_at: '2026-02-06T10:20:00Z',
  },
];

describe('SessionDisplay', () => {
  it('renders scan records in a table', () => {
    render(<SessionDisplay scans={MOCK_SCANS} />);

    expect(screen.getByText('WO-20260206-CABLE001-00001')).toBeInTheDocument();
    expect(screen.getAllByText(/Cutting/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
  });

  it('shows quality status badges', () => {
    render(<SessionDisplay scans={MOCK_SCANS} />);

    expect(screen.getAllByText('OK').length).toBeGreaterThan(0);
    expect(screen.getByText('NOT OK')).toBeInTheDocument();
  });

  it('indicates first article scans', () => {
    render(<SessionDisplay scans={MOCK_SCANS} />);

    // "FA" appears in header (th) and as a data badge (span) — use getAllByText
    const faElements = screen.getAllByText('FA');
    // At least the header + the one first-article scan
    expect(faElements.length).toBeGreaterThanOrEqual(2);
  });

  it('shows empty state when no scans', () => {
    render(<SessionDisplay scans={[]} />);

    expect(screen.getByText(/no scan/i)).toBeInTheDocument();
  });

  it('applies highlight class to specified scan IDs', () => {
    const highlightIds = new Set(['scan-1']);
    const { container } = render(
      <SessionDisplay scans={MOCK_SCANS} highlightIds={highlightIds} />,
    );

    const highlightedRows = container.querySelectorAll('.animate-scan-highlight');
    expect(highlightedRows.length).toBe(1);
  });
});
