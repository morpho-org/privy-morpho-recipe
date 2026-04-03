'use client';

import { useState, useCallback, useEffect } from 'react';

export type StatusKind = 'idle' | 'processing' | 'success' | 'error' | 'info';

interface TxControls {
  setTxHash: (hash: string) => void;
  setStatus: (status: string, kind?: StatusKind) => void;
}

interface TxMessages {
  start: string;
  error: string;
}

export function useTxLifecycle() {
  const [status, setStatusRaw] = useState('');
  const [statusKind, setStatusKind] = useState<StatusKind>('idle');
  const [txHash, setTxHash] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const setStatus = useCallback((msg: string, kind?: StatusKind) => {
    setStatusRaw(msg);
    if (kind) setStatusKind(kind);
  }, []);

  const resetTxState = useCallback(() => {
    setStatusRaw('');
    setStatusKind('idle');
    setTxHash('');
  }, []);

  const executeTx = useCallback(async (
    messages: TxMessages,
    execute: (controls: TxControls) => Promise<void>,
  ) => {
    setIsLoading(true);
    setStatusRaw(messages.start);
    setStatusKind('processing');
    setTxHash('');
    try {
      await execute({
        setTxHash,
        setStatus: (msg: string, kind?: StatusKind) => {
          setStatusRaw(msg);
          setStatusKind(kind ?? 'success');
        },
      });
    } catch (error) {
      console.error(error);
      setStatusRaw(messages.error);
      setStatusKind('error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-clear status after 10 seconds when not loading
  useEffect(() => {
    if (!status || isLoading) return;
    const timer = setTimeout(() => resetTxState(), 10_000);
    return () => clearTimeout(timer);
  }, [status, isLoading, resetTxState]);

  return { status, statusKind, setStatus, txHash, setTxHash, isLoading, executeTx, resetTxState };
}
