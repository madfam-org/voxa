import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { config } from './middleware';

function matches(pathname: string): boolean {
  return config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(pathname));
}

describe('middleware matcher', () => {
  it('serves vendored symbol files without locale rewrite or sign-in redirect', () => {
    assert.equal(matches('/symbols/mulberry/want.svg'), false);
    assert.equal(matches('/symbols/mulberry/ATTRIBUTION.md'), false);
  });

  it('still runs on app pages', () => {
    assert.equal(matches('/demo'), true);
    assert.equal(matches('/es/app'), true);
  });
});
