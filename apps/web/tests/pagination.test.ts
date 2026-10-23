import test from "node:test";
import assert from "node:assert/strict";
import { paginate } from "../lib/pagination";
test("pagination covers every workpaper without truncation and clamps after deletion", () => {
  const records = Array.from({ length: 31 }, (_, i) => i);
  assert.deepEqual([1,2,3,4].flatMap((page) => paginate(records, page, 10).items), records);
  assert.deepEqual(paginate(records, 4, 10), { page: 4, pages: 4, total: 31, from: 31, to: 31, items: [30] });
  const afterDelete = paginate(records.slice(0,30), 4, 10); assert.equal(afterDelete.page, 3); assert.equal(afterDelete.to, 30);
  assert.deepEqual(paginate([], 9, 10), { page: 1, pages: 1, total: 0, from: 0, to: 0, items: [] });
  assert.equal(paginate(records, -1, 20).page, 1); assert.equal(paginate(records, 2, 20).items.length, 11);
});
