/** Local wall-clock parts for an IANA timezone at a given instant. */
export function localParts(ts: number, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ts))) o[p.type] = p.value;
  return { year: +o.year!, month: +o.month!, day: +o.day!, hour: +o.hour!, minute: +o.minute! };
}

export type MealSlot = "breakfast" | "lunch" | "dinner";

/** Local meal windows: [startHour, endHour). */
export const MEAL_WINDOWS: Record<MealSlot, readonly [number, number]> = {
  breakfast: [7, 9],
  lunch: [12, 14],
  dinner: [18, 21],
};

/** Which meal window (if any) is open at this local time. */
export function openMealSlot(ts: number, timeZone: string): MealSlot | null {
  const { hour } = localParts(ts, timeZone);
  for (const [slot, [s, e]] of Object.entries(MEAL_WINDOWS) as [MealSlot, readonly [number, number]][]) {
    if (hour >= s && hour < e) return slot;
  }
  return null;
}
