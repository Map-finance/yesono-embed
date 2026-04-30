export function pnlColor(text: string): string {
  if (text === "-") return "text-(--text-secondary)";
  if (text === "0" || text === "0.00") return "text-amber-500";
  return text.startsWith("-") ? "text-red-500" : "text-emerald-500";
}

export function fmtRatio(raw?: string): string {
  const r = parseFloat(raw || "0");
  if (!Number.isFinite(r) || r <= 0) return "-";
  return r >= 1 ? `${(r * 100).toFixed(0)}%` : `${(r * 100).toFixed(1)}%`;
}

export function formatDynamicAmount(value: string | number, maxDecimals = 8): string {
  if (value === "-" || value === "" || value == null) return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  const isNeg = num < 0;
  const abs = Math.abs(num);
  if (abs === 0) return "0";
  if (abs >= 1) {
    return (isNeg ? -abs : abs).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  let formatted = "0.00";
  for (let d = 2; d <= maxDecimals; d++) {
    const cand = abs.toFixed(d);
    if (Number(cand) !== 0) {
      formatted = cand;
      break;
    }
  }
  const [intPart, fracPartRaw] = formatted.split(".");
  if (!fracPartRaw) return isNeg ? `-${formatted}` : formatted;
  let frac = fracPartRaw;
  while (frac.length > 2 && frac.endsWith("0")) frac = frac.slice(0, -1);
  const result = `${Number(intPart).toLocaleString()}.${frac}`;
  return isNeg ? `-${result}` : result;
}
