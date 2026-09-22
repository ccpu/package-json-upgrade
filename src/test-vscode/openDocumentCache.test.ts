import * as assert from 'assert'
import * as vscode from 'vscode'

import { Config, setConfig } from '../config'
import { CacheItem, getCachedNpmData, NpmLoader, setCachedNpmData } from '../npm'
import { AsyncState, Dict } from '../types'

/**
 * `file:` versions are not semver, so the extension never fetches them. That keeps
 * this test about one thing: opening a dependency file throws away the cached npm
 * data for the dependencies in it, so a reopened file shows fresh versions instead
 * of whatever was cached up to two hours ago.
 */
const packageJsonTestContent = `{
  "dependencies": {
    "package-json-upgrade-test-dep": "file:./foo.tgz"
  }
}
`

const DEPENDENCY_NAME = 'package-json-upgrade-test-dep'

const buildCache = (): Dict<string, NpmLoader<CacheItem>> => ({
  [DEPENDENCY_NAME]: {
    asyncstate: AsyncState.Fulfilled,
    startTime: 0,
    item: {
      date: new Date('2020-09-14T11:01:26.768Z'),
      npmData: {
        'dist-tags': { latest: '1.0.0' },
        versions: { '1.0.0': { name: DEPENDENCY_NAME, version: '1.0.0' } },
      },
    },
  },
  'untouched-dependency': {
    asyncstate: AsyncState.Fulfilled,
    startTime: 0,
    item: {
      date: new Date('2020-09-14T11:01:26.768Z'),
      npmData: {
        'dist-tags': { latest: '2.0.0' },
        versions: { '2.0.0': { name: 'untouched-dependency', version: '2.0.0' } },
      },
    },
  },
})

/** Extra keys are the union of what the fork and upstream ask for. */
const buildTestConfig = (): Config =>
  ({
    showUpdatesAtStart: true,
    showOverviewRulerColor: true,
    skipNpmConfig: true,
    majorUpgradeColorOverwrite: '',
    minorUpgradeColorOverwrite: '',
    patchUpgradeColorOverwrite: '',
    prereleaseUpgradeColorOverwrite: '',
    decorationString: '',
    ignorePatterns: [],
    ignoreVersions: {},
    msUntilRowLoading: 6000,
    dependencyGroups: ['dependencies', 'devDependencies', 'catalog', 'catalogs'],
    minimumReleaseAge: 0,
    minimumReleaseAgeExclude: [],
  }) as Config

const waitUntil = async (predicate: () => boolean, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return predicate()
}

suite('Open document cache invalidation Test Suite', () => {
  suiteSetup(async function () {
    this.timeout(20000)
    setConfig(buildTestConfig())
    // Opening a package.json is what activates the extension, and the listener we
    // are testing only exists once it has. Do that first, in a file of its own, so
    // the activation is not racing the open the test cares about.
    const activationUri = vscode.Uri.parse('./tmp/open-cache-activation/package.json')
    await vscode.workspace.fs.writeFile(activationUri, Buffer.from(packageJsonTestContent))
    const activationDocument = await vscode.workspace.openTextDocument(activationUri)
    await vscode.window.showTextDocument(activationDocument)
    await vscode.extensions.getExtension('ccpu.package-json-upgrade')?.activate()
    await new Promise((resolve) => setTimeout(resolve, 500))
  })

  test('opening a package.json should drop the cached npm data for its dependencies', async function () {
    this.timeout(20000)
    setConfig(buildTestConfig())
    setCachedNpmData(buildCache())

    const uri = vscode.Uri.parse('./tmp/open-cache-target/package.json')
    await vscode.workspace.fs.writeFile(uri, Buffer.from(packageJsonTestContent))
    await vscode.workspace.openTextDocument(uri)

    const cleared = await waitUntil(() => getCachedNpmData(DEPENDENCY_NAME) === undefined, 5000)

    assert.strictEqual(cleared, true, 'cached npm data should have been dropped on open')
  })

  test('opening a package.json should leave dependencies it does not mention alone', async function () {
    this.timeout(20000)
    setConfig(buildTestConfig())
    setCachedNpmData(buildCache())

    const uri = vscode.Uri.parse('./tmp/open-cache-other/package.json')
    await vscode.workspace.fs.writeFile(uri, Buffer.from(packageJsonTestContent))
    await vscode.workspace.openTextDocument(uri)

    await waitUntil(() => getCachedNpmData(DEPENDENCY_NAME) === undefined, 5000)

    assert.notStrictEqual(
      getCachedNpmData('untouched-dependency'),
      undefined,
      'only the opened file’s dependencies should be dropped',
    )
  })
})
