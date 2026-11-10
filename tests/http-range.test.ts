import assert from 'node:assert/strict';
import { test } from 'node:test';
import { byteRange } from '@/lib/http-range';

test('byteRange reads the forms browsers send', () => {
  assert.equal(byteRange(null, 100), null);
  assert.equal(byteRange('', 100), null);
  assert.deepEqual(byteRange('bytes=0-1', 100), { start: 0, end: 1 });
  assert.deepEqual(byteRange('bytes=0-', 100), { start: 0, end: 99 });
  assert.deepEqual(byteRange('bytes=10-', 100), { start: 10, end: 99 });
  assert.deepEqual(byteRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(byteRange('bytes=90-500', 100), { start: 90, end: 99 });
  assert.equal(byteRange('bytes=100-', 100), 'unsatisfiable');
  assert.equal(byteRange('bytes=99999999-', 2818651), 'unsatisfiable');
  assert.equal(byteRange('items=0-1', 100), null);
});
