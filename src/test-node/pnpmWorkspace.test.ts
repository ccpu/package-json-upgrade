import { before, describe, test } from 'node:test'

import * as assert from 'assert'
import { readFileSync } from 'fs'

import { Config, setConfig } from '../config'
import { getPnpmWorkspaceDependencyInformation } from '../pnpm'

/**
 * The parser upstream reads the groups to look at from the config, so the tests
 * set one up. Extra keys are fine: this is deliberately the union of what the
 * fork and upstream ask for, so the same test file keeps compiling on both.
 */
const setTestConfig = () => {
  setConfig({
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
  } as Config)
}

const readFixture = (name: string) => readFileSync(`./src/test-node/testdata/${name}`).toString()

const flatDeps = (yamlAsString: string) =>
  getPnpmWorkspaceDependencyInformation(yamlAsString).flatMap((group) => group.deps)

describe('pnpmWorkspace', () => {
  before(setTestConfig)

  test('should be able to correctly parse a simple pnpm-workspace.yaml', () => {
    const pnpmWorkspaceBuffer = readFileSync('./src/test-node/testdata/pnpm-workspace-test1.yaml')
    const pnpmWorkspace = pnpmWorkspaceBuffer.toString()
    const result = getPnpmWorkspaceDependencyInformation(pnpmWorkspace)
    const dependencies = result.map((r) => r.deps).flat()
    if (
      !dependencies.some(
        (dep) =>
          dep.dependencyName === 'npm-registry-fetch' &&
          dep.currentVersion === '12.0.0' &&
          dep.line === 8,
      )
    ) {
      assert.fail('did not find npm-registry-fetch')
    }

    if (
      !dependencies.some(
        (dep) =>
          dep.dependencyName === '@types/npm-registry-fetch' &&
          dep.currentVersion === '8.0.4' &&
          dep.line === 17,
      )
    ) {
      assert.fail('did not find @types/npm-registry-fetch')
    }

    assert.ok('nice')
  })

  test('should read dependencies from the default catalog', () => {
    const deps = flatDeps(readFixture('pnpm-workspace-test2.yaml'))

    assert.deepStrictEqual(
      deps.filter((dep) => dep.line < 9),
      [
        { dependencyName: 'react', currentVersion: '^19.0.0', line: 4 },
        { dependencyName: '@types/react', currentVersion: '19.0.1', line: 5 },
        { dependencyName: 'semver', currentVersion: '~7.7.0', line: 7 },
      ],
    )
  })

  test('should read dependencies from every named catalog', () => {
    const deps = flatDeps(readFixture('pnpm-workspace-test2.yaml'))

    assert.deepStrictEqual(
      deps.filter((dep) => dep.line > 9),
      [
        { dependencyName: 'react', currentVersion: '^17.0.2', line: 11 },
        { dependencyName: 'typescript', currentVersion: '5.9.2', line: 13 },
        { dependencyName: 'webpack', currentVersion: '5.99.0', line: 14 },
      ],
    )
  })

  test('should keep quoted dependency names unquoted', () => {
    const deps = flatDeps(readFixture('pnpm-workspace-test2.yaml'))

    assert.ok(
      deps.some((dep) => dep.dependencyName === '@types/react'),
      'scoped name should not keep its yaml quotes',
    )
  })

  test('should not pick up the packages list as dependencies', () => {
    const deps = flatDeps(readFixture('pnpm-workspace-test2.yaml'))

    assert.ok(
      deps.every((dep) => dep.dependencyName !== 'packages'),
      'the packages glob list is not a dependency group',
    )
  })

  test('should find nothing in a workspace file without catalogs', () => {
    const deps = flatDeps('packages:\n  - packages/*\n')

    assert.deepStrictEqual(deps, [])
  })
})
