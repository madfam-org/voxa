import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildGridScanPath, clampSwitchInterval, linearScanIndex } from './index.js';

describe('switch scanning', () => {
  it('wraps scan index across grid size', () => {
    assert.equal(linearScanIndex('row-major', 2, 3, 0), 0);
    assert.equal(linearScanIndex('row-major', 2, 3, 6), 0);
    assert.equal(linearScanIndex('row-major', 2, 3, 4), 4);
  });

  it('builds row-major path for 2x2 grid', () => {
    const path = buildGridScanPath(2, 2, 'row-major');
    assert.deepEqual(path, [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 1, column: 0 },
      { row: 1, column: 1 },
    ]);
  });

  it('clamps switch interval to clinical bounds', () => {
    assert.equal(clampSwitchInterval(100), 300);
    assert.equal(clampSwitchInterval(2000), 2000);
    assert.equal(clampSwitchInterval(9000), 5000);
  });
});
