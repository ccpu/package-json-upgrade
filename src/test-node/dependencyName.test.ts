import { beforeEach, describe, test } from 'node:test'

import * as assert from 'assert'

import {
  cleanNpmCache,
  getAllCachedNpmData,
  isRegistryDependencyName,
  refreshDependencies,
} from '../npm'

describe('isRegistryDependencyName', () => {
  test('should accept ordinary package names', () => {
    assert.strictEqual(isRegistryDependencyName('lodash'), true)
    assert.strictEqual(isRegistryDependencyName('npm-registry-fetch'), true)
    assert.strictEqual(isRegistryDependencyName('@types/node'), true)
    assert.strictEqual(isRegistryDependencyName('@my-org/private-package'), true)
  })

  test('should accept the odd shapes real packages have', () => {
    assert.strictEqual(isRegistryDependencyName('JSONStream'), true)
    assert.strictEqual(isRegistryDependencyName('socket.io'), true)
    assert.strictEqual(isRegistryDependencyName('vue3-print-nb'), true)
    assert.strictEqual(isRegistryDependencyName('_'), true)
  })

  test('should reject a name that is a url, which would bypass the registry', () => {
    assert.strictEqual(isRegistryDependencyName('https://example.com/beacon'), false)
    assert.strictEqual(isRegistryDependencyName('http://example.com/beacon'), false)
    assert.strictEqual(isRegistryDependencyName('http://127.0.0.1:8080/probe'), false)
    assert.strictEqual(isRegistryDependencyName('https://user:pass@example.com/'), false)
  })

  test('should reject other schemes as well', () => {
    assert.strictEqual(isRegistryDependencyName('file:///etc/passwd'), false)
    assert.strictEqual(isRegistryDependencyName('ftp://example.com/x'), false)
    assert.strictEqual(isRegistryDependencyName('data:text/plain,hello'), false)
    assert.strictEqual(isRegistryDependencyName('javascript:alert(1)'), false)
  })

  test('should accept a scheme-less url, which is resolved against the registry anyway', () => {
    // "//example.com/x" is not a url on its own, so npm-registry-fetch appends it
    // to the configured registry like any other name. Nothing escapes.
    assert.strictEqual(isRegistryDependencyName('//example.com/x'), true)
  })
})

describe('refreshDependencies', () => {
  beforeEach(() => {
    cleanNpmCache()
  })

  test('should not start a request for a dependency named as a url', () => {
    const promises = refreshDependencies(
      [['https://example.com/beacon', '1.0.0']],
      '/home/user/project/package.json',
    )

    assert.deepStrictEqual(promises, [])
    assert.deepStrictEqual(getAllCachedNpmData(), {})
  })

  test('should not start a request for any of several url dependencies', () => {
    const promises = refreshDependencies(
      [
        ['http://127.0.0.1:9/probe', '1.0.0'],
        ['file:///etc/passwd', '^2.0.0'],
      ],
      '/home/user/project/package.json',
    )

    assert.deepStrictEqual(promises, [])
    assert.deepStrictEqual(getAllCachedNpmData(), {})
  })
})
