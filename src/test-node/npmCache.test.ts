import { beforeEach, describe, test } from 'node:test'

import * as assert from 'assert'

import {
  CacheItem,
  cleanNpmCache,
  clearNpmCacheForDependencies,
  getAllCachedNpmData,
  getCachedNpmData,
  NpmLoader,
  setCachedNpmData,
} from '../npm'
import { AsyncState, Dict } from '../types'

const cacheEntry = (version: string): NpmLoader<CacheItem> => ({
  asyncstate: AsyncState.Fulfilled,
  startTime: 0,
  item: {
    date: new Date('2020-09-14T11:01:26.768Z'),
    npmData: {
      'dist-tags': { latest: version },
      versions: { [version]: { name: 'whatever', version } },
    },
  },
})

const buildCache = (): Dict<string, NpmLoader<CacheItem>> => ({
  semver: cacheEntry('7.7.3'),
  '@types/node': cacheEntry('22.19.7'),
  typescript: cacheEntry('5.9.2'),
})

describe('npm cache invalidation', () => {
  beforeEach(() => {
    cleanNpmCache()
    setCachedNpmData(buildCache())
  })

  test('should only drop the dependencies it was given', () => {
    clearNpmCacheForDependencies(['semver'])

    assert.strictEqual(getCachedNpmData('semver'), undefined)
    assert.notStrictEqual(getCachedNpmData('@types/node'), undefined)
    assert.notStrictEqual(getCachedNpmData('typescript'), undefined)
  })

  test('should drop several dependencies at once', () => {
    clearNpmCacheForDependencies(['semver', '@types/node'])

    assert.deepStrictEqual(Object.keys(getAllCachedNpmData()), ['typescript'])
  })

  test('should leave the cache alone when given an empty list', () => {
    clearNpmCacheForDependencies([])

    assert.deepStrictEqual(Object.keys(getAllCachedNpmData()).sort(), [
      '@types/node',
      'semver',
      'typescript',
    ])
  })

  test('should not blow up on dependencies that were never cached', () => {
    clearNpmCacheForDependencies(['not-cached', 'semver'])

    assert.strictEqual(getCachedNpmData('semver'), undefined)
    assert.strictEqual(getCachedNpmData('not-cached'), undefined)
    assert.deepStrictEqual(Object.keys(getAllCachedNpmData()).sort(), ['@types/node', 'typescript'])
  })

  test('should remove the key, not just blank it, so a refetch is triggered', () => {
    clearNpmCacheForDependencies(['semver'])

    assert.strictEqual(Object.prototype.hasOwnProperty.call(getAllCachedNpmData(), 'semver'), false)
  })
})
