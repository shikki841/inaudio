import { useEffect, useRef, useState } from 'react';
import { toast } from '@renderer/components/ui/toast';
import { errorMessage } from './api';

/**
 * Runs an async click: `pending` is true until it settles, a failure becomes a danger toast
 * instead of an unhandled rejection, and `success` (if given) is said when it works.
 */
export function useAction<A extends unknown[]>(fn: (...args: A) => Promise<unknown>, { success }: { success?: string } = {}) {
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = async (...args: A): Promise<void> => {
    setPending(true);
    try {
      await fn(...args);
      if (success) toast(success);
    } catch (error) {
      toast(errorMessage(error), { tone: 'danger' });
    } finally {
      if (mounted.current) setPending(false);
    }
  };
  return { pending, run };
}
