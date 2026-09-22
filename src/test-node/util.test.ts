import { describe, test } from 'node:test'

import * as assert from 'assert'

import { replaceLastOccuranceOf, waitForPromises } from '../util/util'

const deferred = () => {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

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

describe('waitForPromises', () => {
  test('should return immediately and never call back when there is nothing to wait for', async () => {
    let calls = 0

    await waitForPromises([], { cb: () => (calls += 1), ms: 1 })

    assert.strictEqual(calls, 0)
  })

  test('should only resolve once every promise has settled', async () => {
    const first = deferred()
    const second = deferred()
    let resolved = false

    const waiting = waitForPromises([first.promise, second.promise], {
      cb: () => undefined,
      ms: 5,
    }).then(() => {
      resolved = true
    })

    first.resolve()
    await first.promise
    assert.strictEqual(resolved, false, 'should still be waiting for the second promise')

    second.resolve()
    await waiting
    assert.strictEqual(resolved, true)
  })

  test('should report that something settled so the caller can repaint', async () => {
    const slow = deferred()
    const quick = deferred()
    const reports: boolean[] = []

    const waiting = waitForPromises([quick.promise, slow.promise], {
      cb: (newSettled) => reports.push(newSettled),
      ms: 5,
    })

    setTimeout(() => quick.resolve(), 10)
    setTimeout(() => slow.resolve(), 60)
    await waiting

    assert.ok(reports.length > 0, 'callback should have run while promises were pending')
    assert.ok(reports.includes(true), 'callback should have been told that a promise settled')
  })

  test('should not reject when one of the promises rejects', async () => {
    const failing = Promise.reject(new Error('npm is down'))
    const succeeding = Promise.resolve()

    await waitForPromises([failing, succeeding], { cb: () => undefined, ms: 5 })

    assert.ok('did not throw')
  })
})
