/**
 * Shared moment-style date formatting.
 * Used by ReportService, HeatmapComponent, ReportConfigModal, TaskQuickAddComponent.
 */
export function formatMomentDate(date: Date, format: string): string {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1);
  const d = String(date.getDate());

  const temp = new Date(date.getTime());
  temp.setHours(0, 0, 0, 0);
  temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
  const week1 = new Date(temp.getFullYear(), 0, 4);
  const w = String(
    1 +
      Math.round(
        ((temp.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7
      )
  );

  const Q = String(Math.floor(date.getMonth() / 3) + 1);

  let result = format.replace(/\[([^\]]+)\]/g, "$1");
  result = result
    .replace(/YYYY/g, y)
    .replace(/YY/g, y.slice(2))
    .replace(/MM/g, m.padStart(2, "0"))
    .replace(/DD/g, d.padStart(2, "0"))
    .replace(/ww/g, w.padStart(2, "0"))
    .replace(/M/g, m)
    .replace(/D/g, d)
    .replace(/w/g, w)
    .replace(/Q/g, Q);

  return result;
}
