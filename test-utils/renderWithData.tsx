import type { ReactElement, ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { AppDataProvider, useAppData } from '@/hooks/useAppData';
import type { SqlDb } from '@/lib/db';
import { createMigratedDb } from './nodeDb';

// Like the app's root layout: screens only mount once saved data has loaded.
function ReadyGate({ children }: { children: ReactNode }) {
  const { ready } = useAppData();
  return ready ? <>{children}</> : null;
}

/**
 * Renders `ui` inside a real AppDataProvider backed by an in-memory database.
 * `seed` runs against the database before the provider loads it.
 */
export async function renderWithData(ui: ReactElement, seed?: (db: SqlDb) => Promise<void>) {
  const db = await createMigratedDb();
  if (seed) await seed(db);
  const openDb = () => Promise.resolve(db);
  const utils = render(
    <AppDataProvider openDb={openDb}>
      <ReadyGate>{ui}</ReadyGate>
    </AppDataProvider>
  );
  // The gate renders nothing until the initial load lands.
  await waitFor(() => expect(screen.toJSON()).not.toBeNull());
  return { db, ...utils };
}
