import type { ReactNode } from 'react';
import { ConformProvider } from '../features/shared/ModalConform';
import { ConfirmProvider } from '../features/shared/ConfirmDialog';
import { Toaster } from 'sonner';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ConformProvider>
      <ConfirmProvider>
        <Toaster position="top-right" richColors />
        {children}
      </ConfirmProvider>
    </ConformProvider>
  );
}
