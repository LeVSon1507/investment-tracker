import { useMemo } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useShallow } from 'zustand/shallow';

type SalaryReminderState = {
  shouldShowReminder: boolean;
  currentMonthKey: string;
  dismissReminder: () => void;
};

export function useSalaryReminder(): SalaryReminderState {
  const { salaryDay, lastSalaryReminderDismissed, dismissSalaryReminder } = useSettingsStore(
    useShallow((state) => ({
      salaryDay: state.salaryDay,
      lastSalaryReminderDismissed: state.lastSalaryReminderDismissed,
      dismissSalaryReminder: state.dismissSalaryReminder,
    })),
  );

  const today = useMemo(() => new Date(), []);
  const currentMonthKey = useMemo(
    () => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
    [today],
  );

  const shouldShowReminder = useMemo((): boolean => {
    if (salaryDay <= 0) return false;

    const currentDayOfMonth = today.getDate();
    // Show reminder on salary day and up to 2 days after
    const isWithinReminderWindow =
      currentDayOfMonth >= salaryDay && currentDayOfMonth <= salaryDay + 2;

    const isAlreadyDismissed = lastSalaryReminderDismissed === currentMonthKey;

    return isWithinReminderWindow && !isAlreadyDismissed;
  }, [salaryDay, today, lastSalaryReminderDismissed, currentMonthKey]);

  function dismissReminder(): void {
    dismissSalaryReminder(currentMonthKey);
  }

  return { shouldShowReminder, currentMonthKey, dismissReminder };
}
