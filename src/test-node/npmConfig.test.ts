import { join } from 'node:path'
import { before, describe, test } from 'node:test'

import * as assert from 'assert'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'

import { Config, setConfig } from '../config'
import { getNpmConfig } from '../npmConfig'

/**
 * Extra keys are deliberate: this is the union of what the fork and upstream ask
 * for, so the same test file keeps compiling on both sides of the merge.
 */
const buildTestConfig = (skipNpmConfig: boolean): Config => ({
  showUpdatesAtStart: true,
  showOverviewRulerColor: true,
  skipNpmConfig,
  majorUpgradeColorOverwrite: '',
  minorUpgradeColorOverwrite: '',
  patchUpgradeColorOverwrite: '',
  prereleaseUpgradeColorOverwrite: '',
  decorationString: '',
  ignorePatterns: [],
  ignoreVersions: {},
  msUntilRowLoading: 6000,
  dependencyGroups: ['dependencies', 'devDependencies'],
  minimumReleaseAge: 0,
  minimumReleaseAgeExclude: [],
})

const withEnvironmentVariable = (name: string, value: string, run: () => void) => {
  const previous = process.env[name]
  process.env[name] = value
  try {
    run()
  } finally {
    if (previous === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete process.env[name]
    } else {
      process.env[name] = previous
    }
  }
}

const withTempDir = (prefix: string, run: (dir: string) => void) => {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  try {
    run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * A fresh project directory per call, because the config is memoized per
 * package.json path.
 */
const withTempProject = (npmrc: string | undefined, run: (packageJsonPath: string) => void) => {
  withTempDir('npmconfig-project-', (projectDir) => {
    if (npmrc !== undefined) {
      writeFileSync(join(projectDir, '.npmrc'), npmrc)
    }
    run(join(projectDir, 'package.json'))
  })
}

const withGlobalNpmrc = (contents: string, run: () => void) => {
  withTempDir('npmconfig-global-', (globalDir) => {
    const globalConfigPath = join(globalDir, 'npmrc')
    writeFileSync(globalConfigPath, contents)
    withEnvironmentVariable('npm_config_globalconfig', globalConfigPath, run)
  })
}

/**
 * These go through the real `getNpmConfig`, so they describe what the extension
 * ends up handing to npm-registry-fetch rather than how the config is read. That
 * is deliberate: the config library is an implementation detail that has already
 * been swapped once, and these should hold whichever one is in use.
 */
describe('getNpmConfig', () => {
  before(() => {
    setConfig(buildTestConfig(false))
  })

  test('should read the registry from the .npmrc next to package.json', () => {
    withTempProject('registry=https://custom.example.com/\n', (packageJsonPath) => {
      assert.strictEqual(getNpmConfig(packageJsonPath).registry, 'https://custom.example.com/')
    })
  })

  test('should read a scoped registry from the .npmrc next to package.json', () => {
    withTempProject('@myorg:registry=https://npm.myorg.com/\n', (packageJsonPath) => {
      assert.strictEqual(getNpmConfig(packageJsonPath)['@myorg:registry'], 'https://npm.myorg.com/')
    })
  })

  test('should expand an environment variable used in a project .npmrc', () => {
    withEnvironmentVariable('PACKAGE_JSON_UPGRADE_TEST_TOKEN', 'secret-token', () => {
      const authTokenLine =
        '//npm.pkg.github.com/:_authToken=$' + '{PACKAGE_JSON_UPGRADE_TEST_TOKEN}\n'

      withTempProject(authTokenLine, (packageJsonPath) => {
        assert.strictEqual(
          getNpmConfig(packageJsonPath)['//npm.pkg.github.com/:_authToken'],
          'secret-token',
        )
      })
    })
  })

  test('should read the global npmrc that npm_config_globalconfig points at', () => {
    withGlobalNpmrc('registry=https://global.example.com/\n', () => {
      withTempProject(undefined, (packageJsonPath) => {
        assert.strictEqual(getNpmConfig(packageJsonPath).registry, 'https://global.example.com/')
      })
    })
  })

  test('should let a project .npmrc win over the global one', () => {
    withGlobalNpmrc('registry=https://global.example.com/\n', () => {
      withTempProject('registry=https://project.example.com/\n', (packageJsonPath) => {
        assert.strictEqual(getNpmConfig(packageJsonPath).registry, 'https://project.example.com/')
      })
    })
  })

  test('should hand back an empty config when the user asked to skip npm config', () => {
    setConfig(buildTestConfig(true))
    try {
      withTempProject('registry=https://custom.example.com/\n', (packageJsonPath) => {
        assert.deepStrictEqual(getNpmConfig(packageJsonPath), {})
      })
    } finally {
      setConfig(buildTestConfig(false))
    }
  })
})
