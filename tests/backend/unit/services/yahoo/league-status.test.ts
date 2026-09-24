import { describe, expect, it } from 'vitest';
import { classifyLeague, yahooFlag } from '../../../../../server/services/yahoo/league-status';

describe('yahooFlag', () => {
  it('normalizes every flag form Yahoo sends', () => {
    for (const value of [true, 1, '1', 'true']) {
      expect(yahooFlag(value)).toBe(true);
    }
    for (const value of [false, 0, '0', 'false']) {
      expect(yahooFlag(value)).toBe(false);
    }
    for (const value of [undefined, null, '', 'yes', 2]) {
      expect(yahooFlag(value)).toBeUndefined();
    }
  });
});

describe('classifyLeague', () => {
  const today = '2026-09-23';
  const classify = (league: Record<string, unknown>, game: Record<string, unknown> = {}) =>
    classifyLeague({ game, league, today });

  it('marks finished leagues whatever the flag representation', () => {
    expect(classify({ is_finished: '1' })).toBe('finished');
    expect(classify({ is_finished: 1 })).toBe('finished');
    expect(classify({ is_finished: '0' }, { is_game_over: '1' })).toBe('finished');
    expect(classify({ current_week: '24', end_week: '23' })).toBe('finished');
  });

  it('marks leagues that have not started as preseason', () => {
    expect(classify({ draft_status: 'predraft' })).toBe('preseason');
    expect(classify({ start_date: '2026-10-20', current_week: '1', end_week: '23' })).toBe('preseason');
    expect(classify({ is_finished: '0' }, { is_offseason: '1' })).toBe('preseason');
  });

  it('treats in-progress leagues as active, including their final week', () => {
    expect(classify({ is_finished: '0', current_week: '12', end_week: '23', start_date: '2025-10-21' })).toBe('active');
    expect(classify({ is_finished: 0, current_week: '23', end_week: '23', draft_status: 'postdraft' })).toBe('active');
    expect(classify({})).toBe('active');
  });

  it('lets finished win over preseason signals', () => {
    expect(classify({ is_finished: '1', draft_status: 'predraft' }, { is_offseason: '1' })).toBe('finished');
  });
});
