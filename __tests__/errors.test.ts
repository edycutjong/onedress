import { describe, expect, it } from 'vitest';
import { YouCamError } from '@/lib/youcam/client';
import { isRetryable, toUserFacingError } from '@/lib/youcam/errors';

/**
 * design.md's States table requires the failed-upload card to show re-shoot
 * guidance derived from the REAL error code. These tests pin that mapping: a user
 * must never see `error_face_angle_upward` on screen.
 */

describe('toUserFacingError', () => {
  it('turns a capture error into an instruction, not a code', () => {
    const mapped = toUserFacingError(new YouCamError('boom', 'error_lighting_dark'));
    expect(mapped.title).toBe('More light');
    expect(mapped.guidance).toMatch(/window|lamp|light/i);
    expect(mapped.recovery).toBe('reshoot');
  });

  it('handles the documented wildcard families by prefix', () => {
    expect(toUserFacingError(new YouCamError('x', 'error_face_angle_upward')).recovery).toBe(
      'reshoot',
    );
    expect(toUserFacingError(new YouCamError('x', 'error_face_position_left')).title).toBe(
      'Center the face',
    );
  });

  it('separates transient failures from ones the user must fix', () => {
    expect(isRetryable(new YouCamError('x', 'poll_timeout'))).toBe(true);
    expect(isRetryable(new YouCamError('x', 'network'))).toBe(true);
    expect(isRetryable(new YouCamError('x', 'http_503'))).toBe(true);
    expect(isRetryable(new YouCamError('x', 'error_pose'))).toBe(false);
    expect(isRetryable(new YouCamError('x', 'http_401'))).toBe(false);
  });

  it('treats a missing reference asset as a setup problem, not a bad photo', () => {
    expect(toUserFacingError(new YouCamError('x', 'missing_ref_asset')).recovery).toBe('config');
  });

  it('never throws on an unknown or non-Error value', () => {
    expect(toUserFacingError('just a string').recovery).toBe('unknown');
    expect(toUserFacingError(undefined).title).toBe('Something went wrong');
    expect(toUserFacingError(new Error('plain')).guidance).toBe('plain');
  });

  it('classifies unmapped 4xx as re-shoot and 5xx as retry', () => {
    expect(toUserFacingError(new YouCamError('x', 'http_418')).recovery).toBe('reshoot');
    expect(toUserFacingError(new YouCamError('x', 'http_500')).recovery).toBe('retry');
  });
});
