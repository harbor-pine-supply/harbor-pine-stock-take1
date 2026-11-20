// Low-stock report over the warehouse inventory export.
// The export comes from another system, so every field is validated: a bad row
// is never dropped silently, it is listed under "Skipped" with the reason.

/** A name fit for display. A bad name never hides a low-stock row: it's shown as a placeholder. */
function displayName(name) {
  if (name === undefined || name === null || name === "") return "(no name)";
  return typeof name === "string" ? name : "(invalid name)";
}

/**
 * Escape characters that could change what the terminal shows: control characters
 * (newlines, ANSI escapes), line/paragraph separators and bidi overrides.
 */
function safe(text) {
  return String(text).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

/** Why a quantity field is unusable, or null if it's a non-negative integer. */
function problem(field, value) {
  if (value === undefined || value === null) return `${field} is missing`;
  if (!Number.isInteger(value)) return `${field} is not an integer (${JSON.stringify(value)})`;
  if (value < 0) return `${field} is negative (${value})`;
  return null;
}

/**
 * Build the report. Returns { low, skipped }:
 * - low: { sku, name, count, reorder_level, shortfall } for every item with
 *   count <= reorder_level, sorted by shortfall (largest first), then by SKU.
 * - skipped: { sku, reason } for every item that couldn't be checked.
 */
export function lowStockReport(items) {
  const low = [];
  const skipped = [];
  for (const item of items) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      skipped.push({ sku: "(no sku)", reason: "item is not an object" });
      continue;
    }
    const sku = typeof item.sku === "string" && item.sku.trim() !== "" ? item.sku : "(no sku)";
    const reasons = [problem("count", item.count), problem("reorder_level", item.reorder_level)].filter(Boolean);
    if (sku === "(no sku)") reasons.unshift("sku is missing");
    if (reasons.length) { skipped.push({ sku, reason: reasons.join("; ") }); continue; }
    if (item.count <= item.reorder_level) {
      low.push({ sku, name: displayName(item.name), count: item.count, reorder_level: item.reorder_level, shortfall: item.reorder_level - item.count });
    }
  }
  low.sort((a, b) => b.shortfall - a.shortfall || (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0));
  return { low, skipped };
}

/** Turn a report into the text the command prints. */
export function formatReport({ low, skipped }) {
  const lines = [];
  if (low.length === 0) {
    lines.push("No low-stock items.");
  } else {
    const header = ["SKU", "Name", "Count", "Reorder level", "Shortfall"];
    const rows = low.map((r) => [safe(r.sku), safe(r.name), String(r.count), String(r.reorder_level), String(r.shortfall)]);
    const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
    const fmt = (cells) => cells.map((c, i) => (i >= 2 ? c.padStart(widths[i]) : c.padEnd(widths[i]))).join("  ").trimEnd();
    lines.push(`Low stock (${low.length}):`, fmt(header), ...rows.map(fmt));
  }
  if (skipped.length) {
    lines.push("", `Skipped (${skipped.length}):`, ...skipped.map((s) => `${safe(s.sku)}: ${safe(s.reason)}`));
  }
  return lines.join("\n");
}
