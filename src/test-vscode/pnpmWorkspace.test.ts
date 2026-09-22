import * as assert from 'assert'
import * as vscode from 'vscode'

import { Config, setConfig } from '../config'
import { CacheItem, NpmLoader, setCachedNpmData } from '../npm'
import { AsyncState, Dict } from '../types'
import { updateAll } from '../updateAll'

const pnpmWorkspaceTestContent = `packages:
  - packages/*

catalog:
  '@emotion/babel-plugin': ^11.0.0-next.12

catalogs:
  build:
    '@emotion/babel-plugin': 11.0.0-next.13
`

/**
 * Built fresh per test: the cache object handed to `setCachedNpmData` becomes the
 * extension's own cache, and the extension mutates it as it refreshes files.
 */
const buildNpmCache = (): Dict<string, NpmLoader<CacheItem>> => ({
  '@emotion/babel-plugin': {
    asyncstate: AsyncState.Fulfilled,
    startTime: 0,
    item: {
      date: new Date('2020-09-14T11:01:26.768Z'),
      npmData: {
        'dist-tags': { next: '11.0.0-next.10', latest: '11.0.0-next.17' },
        versions: {
          '11.0.0-next.12': {
            name: '@emotion/babel-plugin',
            version: '11.0.0-next.12',
          },
          '11.0.0-next.13': {
            name: '@emotion/babel-plugin',
            version: '11.0.0-next.13',
          },
          '11.0.0-next.17': {
            name: '@emotion/babel-plugin',
            version: '11.0.0-next.17',
          },
        },
        homepage: 'https://emotion.sh',
      },
    },
  },
})

/**
 * Extra keys are deliberate: this is the union of what the fork and upstream ask
 * for, so the same test file keeps compiling on both sides of the merge.
 */
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
    dependencyGroups: [
      'dependencies',
      'devDependencies',
      'catalog',
      'catalogs',
      'workspaces.catalog',
      'workspaces.catalogs',
    ],
    minimumReleaseAge: 0,
    minimumReleaseAgeExclude: [],
  }) as Config

let testRun = 0

/** A fresh directory per call, so no test sees another test's edited document. */
const openTestDocument = async (fileName: string, content: string) => {
  testRun += 1
  const uri = vscode.Uri.parse(`./tmp/pnpm-${testRun}/${fileName}`)
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content))
  const document = await vscode.workspace.openTextDocument(uri)
  return vscode.window.showTextDocument(document)
}

suite('pnpm-workspace.yaml Test Suite', () => {
  test('updateAll should upgrade catalog entries', async function () {
    const textEditor = await openTestDocument('pnpm-workspace.yaml', pnpmWorkspaceTestContent)

    // Seeded after the editor is shown: showing it makes the extension refresh the
    // file, and that refresh writes its own entries into the npm cache.
    setConfig(buildTestConfig())
    setCachedNpmData(buildNpmCache())

    const result = updateAll(textEditor)

    assert.deepStrictEqual(
      result.map((edit) => edit.text),
      ["  '@emotion/babel-plugin': ^11.0.0-next.17", "    '@emotion/babel-plugin': 11.0.0-next.17"],
    )
  })

  test('updateAll should edit the lines the catalog entries sit on', async function () {
    const textEditor = await openTestDocument('pnpm-workspace.yaml', pnpmWorkspaceTestContent)

    // Seeded after the editor is shown: showing it makes the extension refresh the
    // file, and that refresh writes its own entries into the npm cache.
    setConfig(buildTestConfig())
    setCachedNpmData(buildNpmCache())

    const result = updateAll(textEditor)

    assert.deepStrictEqual(
      result.map((edit) => edit.range.start.line),
      [4, 8],
    )
  })

  test('updateAll should do nothing to a file that is not a dependency file', async function () {
    const textEditor = await openTestDocument(
      'not-a-dependency-file.yaml',
      pnpmWorkspaceTestContent,
    )

    // Seeded after the editor is shown: showing it makes the extension refresh the
    // file, and that refresh writes its own entries into the npm cache.
    setConfig(buildTestConfig())
    setCachedNpmData(buildNpmCache())

    const result = updateAll(textEditor)

    assert.deepStrictEqual(result, [])
  })
})
