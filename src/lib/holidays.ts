import { isWeekend, format } from "date-fns";

export const PUBLIC_HOLIDAYS = [
  "2026-01-01", // New Year
  "2026-04-06", // Chakri Day
  "2026-04-13", // Songkran
  "2026-04-14", // Songkran
  "2026-04-15", // Songkran
  "2026-05-01", // Labor Day
  "2026-05-04", // Coronation Day
  "2026-06-03", // Queen's Birthday
  "2026-07-28", // King's Birthday
  "2026-08-12", // Mother's Day
  "2026-10-13", // Rama IX Memorial
  "2026-10-23", // Chulalongkorn Day
  "2026-12-05", // Father's Day
  "2026-12-10", // Constitution Day
  "2026-12-31", // New Year's Eve
];

export const isOperationalDay = (date: Date) => {
  if (isWeekend(date)) return false;
  const dateStr = format(date, 'yyyy-MM-dd');
  if (PUBLIC_HOLIDAYS.includes(dateStr)) return false;
  return true;
};
