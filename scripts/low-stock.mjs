#!/usr/bin/env node
// Low-stock report: which products need reordering.
// Usage: node scripts/low-stock.mjs [inventory.json]   (default: data/inventory.json)
// Exit code 0 whenever the report runs; 1 if the file can't be read.

import { fileURLToPath } from "node:url";
import { loadInventory } from "../src/inventory.js";
import { lowStockReport, formatReport } from "../src/low-stock.js";

const path = process.argv[2] ?? fileURLToPath(new URL("../data/inventory.json", import.meta.url));

try {
  console.log(formatReport(lowStockReport(loadInventory(path))));
} catch (e) {
  console.error(`low-stock: ${e.message}`);
  process.exit(1);
}
