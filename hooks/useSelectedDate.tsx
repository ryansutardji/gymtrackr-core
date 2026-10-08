import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { todayKey } from '@/lib/dates';
import type { DateKey } from '@/lib/types';

type SelectedDate = { selectedDate: DateKey; setSelectedDate: (d: DateKey) => void };

const SelectedDateContext = createContext<SelectedDate | null>(null);

/**
 * The Calendar's selected day, shared so other screens (Stats "Open day ›")
 * can jump the Calendar to a date. Starts on today.
 */
export function SelectedDateProvider({ children, initial }: { children: ReactNode; initial?: DateKey }) {
  const [selectedDate, setSelectedDate] = useState<DateKey>(() => initial ?? todayKey());
  const value = useMemo(() => ({ selectedDate, setSelectedDate }), [selectedDate]);
  return <SelectedDateContext.Provider value={value}>{children}</SelectedDateContext.Provider>;
}

export function useSelectedDate(): SelectedDate {
  const ctx = useContext(SelectedDateContext);
  if (!ctx) throw new Error('useSelectedDate must be used inside <SelectedDateProvider>');
  return ctx;
}
