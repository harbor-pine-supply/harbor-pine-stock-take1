import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { lowStockReport, formatReport } from "../src/low-stock.js";
import { loadInventory } from "../src/inventory.js";

const script = fileURLToPath(new URL("../scripts/low-stock.mjs", import.meta.url));
const dataFile = fileURLToPath(new URL("../data/inventory.json", import.meta.url));
const item = (sku, count, reorder_level, name = `${sku} name`) => ({ sku, name, count, reorder_level });
const skus = (rows) => rows.map((r) => r.sku);

// Criterion 1
test("an item below its reorder level is listed", () => {
  const { low } = lowStockReport([item("A", 3, 5), item("B", 9, 5)]);
  assert.deepEqual(skus(low), ["A"]);
  assert.equal(low[0].shortfall, 2);
});

// Criterion 2
test("an item exactly at its reorder level is listed, one above is not", () => {
  const { low } = lowStockReport([item("AT", 6, 6), item("ABOVE", 7, 6)]);
  assert.deepEqual(skus(low), ["AT"]);
  assert.equal(low[0].shortfall, 0);
});

// Criterion 3
test("bad count or reorder_level is listed under Skipped with the reason", () => {
  const items = [
    { sku: "NO-LEVEL", name: "x", count: 1 },
    { sku: "NO-COUNT", name: "x", reorder_level: 1 },
    item("STR-COUNT", "4", 5),
    item("STR-LEVEL", 4, "5"),
    item("FLOAT", 1.5, 2),
    item("NEG-COUNT", -1, 2),
    item("NEG-LEVEL", 1, -2),
    item("NULL-COUNT", null, 2),
  ];
  const { low, skipped } = lowStockReport(items);
  assert.equal(low.length, 0);
  assert.deepEqual(skipped, [
    { sku: "NO-LEVEL", reason: "reorder_level is missing" },
    { sku: "NO-COUNT", reason: "count is missing" },
    { sku: "STR-COUNT", reason: 'count is not an integer ("4")' },
    { sku: "STR-LEVEL", reason: 'reorder_level is not an integer ("5")' },
    { sku: "FLOAT", reason: "count is not an integer (1.5)" },
    { sku: "NEG-COUNT", reason: "count is negative (-1)" },
    { sku: "NEG-LEVEL", reason: "reorder_level is negative (-2)" },
    { sku: "NULL-COUNT", reason: "count is missing" },
  ]);
  assert.match(formatReport({ low, skipped }), /Skipped \(8\):\nNO-LEVEL: reorder_level is missing/);
});

test("rows with no SKU or that aren't objects are skipped, not dropped", () => {
  const items = [{ name: "x", count: 1, reorder_level: 2 }, null, "junk", item("OK", 9, 1), item("LOW", 1, 2)];
  const { low, skipped } = lowStockReport(items);
  assert.deepEqual(skipped, [
    { sku: "(no sku)", reason: "sku is missing" },
    { sku: "(no sku)", reason: "item is not an object" },
    { sku: "(no sku)", reason: "item is not an object" },
  ]);
  assert.deepEqual(skus(low), ["LOW"]);
  // Every item is accounted for: low + skipped + fine = total.
  assert.equal(low.length + skipped.length + 1, items.length);
});

// Threat model (second opinion, finding 1): a bad name must not crash the report or hide a low item.
test("a malformed or missing name doesn't crash the report and the row stays listed", () => {
  const items = [
    { sku: "EVIL-NAME", name: JSON.parse('{"toString": null}'), count: 0, reorder_level: 2 },
    { sku: "NO-NAME", count: 1, reorder_level: 2 },
    item("OK", 1, 2, "Fine"),
  ];
  const report = lowStockReport(items);
  assert.deepEqual(skus(report.low), ["EVIL-NAME", "NO-NAME", "OK"]);
  const out = formatReport(report);
  assert.match(out, /EVIL-NAME\s+\(invalid name\)\s+0\s+2\s+2$/m);
  assert.match(out, /NO-NAME\s+\(no name\)\s+1\s+2\s+1$/m);
});

// Threat model (second opinion, finding 2): data can't forge lines or send terminal escapes.
test("control characters in SKU, name and skipped rows are escaped in the output", () => {
  const items = [
    item("FAKE\nSTOVE-1B", 0, 1, "Clear\u001b[2J screen"),
    { sku: "BAD\r\u202eSKU", name: "x", count: "1\n2", reorder_level: 1 },
  ];
  const out = formatReport(lowStockReport(items));
  assert.doesNotMatch(out, /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u202a-\u202e]/);
  assert.equal(out.split("\n").length, 6); // title, header, 1 row, blank, "Skipped", 1 row
  assert.match(out, /FAKE\\u000aSTOVE-1B\s+Clear\\u001b\[2J screen/);
  assert.match(out, /BAD\\u000d\\u202eSKU: count is not an integer \("1\\n2"\)/);
});

// Criterion 4
test("rows are sorted by shortfall, largest first, then by SKU", () => {
  const { low } = lowStockReport([item("Z-TIE", 2, 2), item("SMALL", 4, 5), item("A-TIE", 2, 2), item("BIG", 0, 9)]);
  assert.deepEqual(skus(low), ["BIG", "SMALL", "A-TIE", "Z-TIE"]);
});

// Criterion 5
test("each row shows SKU, name, count, reorder level and shortfall", () => {
  const out = formatReport(lowStockReport([item("TENT-2P", 3, 5, "Ridgeline 2-person tent")]));
  assert.match(out, /SKU\s+Name\s+Count\s+Reorder level\s+Shortfall/);
  assert.match(out, /TENT-2P\s+Ridgeline 2-person tent\s+3\s+5\s+2$/m);
});

// Criterion 6
test("with no low items it prints 'No low-stock items.'", () => {
  assert.equal(formatReport(lowStockReport([item("A", 9, 1)])), "No low-stock items.");
});

test("the command prints 'No low-stock items.' and exits 0 when nothing is low", () => {
  const file = join(mkdtempSync(join(tmpdir(), "low-")), "inventory.json");
  writeFileSync(file, JSON.stringify([item("A", 9, 1)]));
  const r = spawnSync(process.execPath, [script, file], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), "No low-stock items.");
});

// Criterion 7 / "How we'll verify": today's export (read only).
test("today's data/inventory.json gives the expected report", () => {
  const { low, skipped } = lowStockReport(loadInventory(dataFile));
  assert.deepEqual(skus(low), ["STOVE-1B", "TENT-2P", "AXE-HAND", "BAG-20F", "LANTERN-LED"]);
  assert.deepEqual(skus(skipped), ["PAD-FOAM", "FILTER-H2O"]);
  const r = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /STOVE-1B[\s\S]*TENT-2P[\s\S]*AXE-HAND[\s\S]*BAG-20F[\s\S]*LANTERN-LED[\s\S]*Skipped \(2\)/);
});
