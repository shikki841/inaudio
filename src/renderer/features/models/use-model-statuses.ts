import { useQuery } from '@tanstack/react-query';
import type { ModelStatus } from '@shared/domain/models';
import { api } from '@renderer/lib/api';
import { keys } from '@renderer/lib/queries';

export function useModels() {
  return useQuery({ queryKey: keys.models, queryFn: () => api.models.list(), refetchInterval: 5_000 });
}

export function useModelStatuses(): ModelStatus[] {
  return useModels().data ?? [];
}
