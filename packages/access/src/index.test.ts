import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildGridScanPath,
  buildGroupCellPath,
  buildRegionScanGroups,
  buildRowScanGroups,
  clampSwitchInterval,
  classifySwitchKey,
  classifySwitchNativeKey,
  groupScanLabel,
  linearScanIndex,
  resolveScanGroups,
} from './index.js';

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

  it('builds row and region scan groups', () => {
    const rows = buildRowScanGroups(3, 4);
    assert.equal(rows.length, 3);
    assert.equal(rows[0]?.length, 4);
    assert.equal(rows[1]?.[0]?.row, 1);

    const regions = buildRegionScanGroups(4, 4);
    assert.equal(regions.length, 4);
    assert.equal(regions[0]?.length, 4);
  });

  it('scans cells inside a group using grid order', () => {
    const group = buildRowScanGroups(2, 3)[0]!;
    const path = buildGroupCellPath(group, 2, 3, 'row-major');
    assert.deepEqual(path, [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
    ]);
  });

  it('labels row groups for auditory scan', () => {
    const groups = resolveScanGroups(2, 2, 'rows');
    assert.ok(groups);
    assert.equal(groupScanLabel(1, 'rows', groups[1]!), 'Row 2');
  });
});

describe('hardware switch input', () => {
  it('maps USB switch key codes to scan actions', () => {
    assert.equal(classifySwitchKey('Space'), 'select');
    assert.equal(classifySwitchKey('Enter'), 'select');
    assert.equal(classifySwitchKey('ArrowRight'), 'advance');
    assert.equal(classifySwitchKey('Tab'), 'advance');
    assert.equal(classifySwitchKey('F13'), 'advance');
    assert.equal(classifySwitchKey('KeyA'), null);
  });

  it('maps native keyboard keys from BT switches on mobile', () => {
    assert.equal(classifySwitchNativeKey(' '), 'select');
    assert.equal(classifySwitchNativeKey('Enter'), 'select');
    assert.equal(classifySwitchNativeKey('Tab'), 'advance');
    assert.equal(classifySwitchNativeKey('ArrowRight'), 'advance');
    assert.equal(classifySwitchNativeKey('a'), null);
  });
});
