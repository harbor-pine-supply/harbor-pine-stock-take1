# Harbor & Pine stock tools

Small command-line tools over the warehouse's inventory export (`data/inventory.json`). Harbor & Pine Supply is a fictional company and all data here is made up.

## Run the checks

```bash
node scripts/check.mjs
```

One line: PASS or FAIL. The detail is in `.scratch/check.log`.

## Low-stock report

```bash
node scripts/low-stock.mjs                  # reads data/inventory.json
node scripts/low-stock.mjs other-export.json
```

Lists every product whose count is at or below its reorder level, with the SKU, name, count, reorder level and shortfall (`reorder_level - count`), largest shortfall first. Rows with a missing, non-integer or negative count or reorder level are listed under "Skipped" with the reason, never dropped. If nothing is low it prints `No low-stock items.` It exits 0 whenever the report runs.

## How changes are made here
- Each change starts from a work package in `docs/work-packages/`.
- Claude Code builds it, with hooks that block secrets and run the check after every edit.
- Codex gives a read-only second opinion (`node scripts/second-opinion.mjs`); every finding is accepted, accepted in part or declined, with a reason.
- A pull request needs the check to pass and a person's approval before it merges.
