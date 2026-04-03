import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTxLifecycle } from '@/hooks/useTxLifecycle';

describe('useTxLifecycle', () => {
  it('starts with idle state', () => {
    const { result } = renderHook(() => useTxLifecycle());
    expect(result.current.status).toBe('');
    expect(result.current.statusKind).toBe('idle');
    expect(result.current.txHash).toBe('');
    expect(result.current.isLoading).toBe(false);
  });

  it('setStatus updates message and kind', () => {
    const { result } = renderHook(() => useTxLifecycle());
    act(() => result.current.setStatus('Processing...', 'processing'));
    expect(result.current.status).toBe('Processing...');
    expect(result.current.statusKind).toBe('processing');
  });

  it('setStatus without kind keeps previous kind', () => {
    const { result } = renderHook(() => useTxLifecycle());
    act(() => result.current.setStatus('msg1', 'error'));
    act(() => result.current.setStatus('msg2'));
    expect(result.current.status).toBe('msg2');
    expect(result.current.statusKind).toBe('error');
  });

  it('resetTxState clears everything', () => {
    const { result } = renderHook(() => useTxLifecycle());
    act(() => {
      result.current.setStatus('Something', 'success');
      result.current.setTxHash('0xabc');
    });
    act(() => result.current.resetTxState());
    expect(result.current.status).toBe('');
    expect(result.current.statusKind).toBe('idle');
    expect(result.current.txHash).toBe('');
  });

  it('executeTx sets processing then success on resolve', async () => {
    const { result } = renderHook(() => useTxLifecycle());

    await act(async () => {
      await result.current.executeTx(
        { start: 'Working...', error: 'Failed!' },
        async ({ setStatus, setTxHash }) => {
          setTxHash('0xhash');
          setStatus('Done!');
        },
      );
    });

    expect(result.current.status).toBe('Done!');
    expect(result.current.statusKind).toBe('success');
    expect(result.current.txHash).toBe('0xhash');
    expect(result.current.isLoading).toBe(false);
  });

  it('executeTx sets error status on rejection', async () => {
    const { result } = renderHook(() => useTxLifecycle());

    await act(async () => {
      await result.current.executeTx(
        { start: 'Working...', error: 'Something failed.' },
        async () => {
          throw new Error('boom');
        },
      );
    });

    expect(result.current.status).toBe('Something failed.');
    expect(result.current.statusKind).toBe('error');
    expect(result.current.isLoading).toBe(false);
  });

  it('isLoading is false after execution completes', async () => {
    const { result } = renderHook(() => useTxLifecycle());

    await act(async () => {
      await result.current.executeTx(
        { start: 'Go', error: 'Err' },
        async ({ setStatus }) => {
          setStatus('Done');
        },
      );
    });

    // After executeTx resolves, isLoading should be false
    expect(result.current.isLoading).toBe(false);
    expect(result.current.status).toBe('Done');
  });

  it('setTxHash updates hash', () => {
    const { result } = renderHook(() => useTxLifecycle());
    act(() => result.current.setTxHash('0x123'));
    expect(result.current.txHash).toBe('0x123');
  });
});
