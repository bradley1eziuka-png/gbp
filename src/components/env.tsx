'use client';

import { createContext, useContext } from 'react';
import type { FileMeta } from '@/lib/form/types';

export interface FormEnv {
  files: FileMeta[];
  previews: Record<string, string>;
  upload: (category: string, file: File, onProgress: (pct: number) => void) => Promise<FileMeta>;
  remove: (id: string) => Promise<void>;
  vars: { privacy?: string; terms?: string };
}

export const FormEnvContext = createContext<FormEnv | null>(null);

export function useFormEnv(): FormEnv {
  const v = useContext(FormEnvContext);
  if (!v) throw new Error('FormEnvContext missing');
  return v;
}
