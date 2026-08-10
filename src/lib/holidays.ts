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
  "2026-07-29", // Special Holiday (Blocked)
  "2026-07-30", // Special Holiday (Blocked)
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

export interface BookingConfig {
  openTime: string;
  closeTime: string;
  closeHour: number;
  closeMinute: number;
  slots: string[];
}

export const getBookingConfig = (date: Date): BookingConfig => {
  if (isWeekend(date)) {
    return {
      openTime: "09:00",
      closeTime: "16:00",
      closeHour: 16,
      closeMinute: 0,
      slots: []
    };
  }
  return {
    openTime: "08:00",
    closeTime: "16:30",
    closeHour: 16,
    closeMinute: 30,
    slots: ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"]
  };
};
