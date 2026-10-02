const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Cairo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function cairoDate(now = new Date()) {
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDateDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function cairoMidnightUtc(date: string) {
  const target = new Date(`${date}T00:00:00Z`);
  let instant = target;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(
        formatter.formatToParts(instant).map((part) => [part.type, part.value]),
      ),
      represented = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
      ),
      offset = represented - instant.getTime();
    instant = new Date(target.getTime() - offset);
  }
  return instant.toISOString();
}

export function cairoPeriod(period: "today" | "month" | "year") {
  const today = cairoDate(),
    from =
      period === "year"
        ? `${today.slice(0, 4)}-01-01`
        : period === "month"
          ? `${today.slice(0, 7)}-01`
          : today;
  return {
    from: cairoMidnightUtc(from),
    to: cairoMidnightUtc(addDateDays(today, 1)),
    fromDate: from,
    toDate: addDateDays(today, 1),
  };
}

export function cairoDailyTotals(
  rows: { created_at: string; total: number }[],
) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const day = cairoDate(new Date(row.created_at));
    totals.set(day, (totals.get(day) || 0) + Number(row.total || 0));
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, total]) => ({ day, total }));
}
