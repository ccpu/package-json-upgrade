import { describe, test } from 'node:test'

import * as assert from 'assert'

import { replaceLastOccuranceOf } from '../util/util'

describe('replaceLastOccuranceOf', () => {
  test('should replace the version at the end of a package.json line', () => {
    assert.strictEqual(
      replaceLastOccuranceOf('    "semver": "^7.3.5"', '7.3.5', '7.7.3'),
      '    "semver": "^7.7.3"',
    )
  })

  test('should return the line untouched when there is nothing to replace', () => {
    assert.strictEqual(
      replaceLastOccuranceOf('    "semver": "^7.3.5"', '1.0.0', '2.0.0'),
      '    "semver": "^7.3.5"',
    )
  })
})
