import { dirname, join } from 'node:path'
import { test } from 'node:test'

import * as assert from 'assert'

import { expandNpmConfigEnvironmentVariables, getNpmConfigReadOptions } from '../npmConfig'

test('expands environment variables in .npmrc values', () => {
  const tokenReference = '$' + '{GH_PACKAGES_TOKEN}'
  const missingReference = '$' + '{MISSING_TOKEN}'
  const escapedReference = '\\' + tokenReference

  const result = expandNpmConfigEnvironmentVariables(
    {
      '//npm.pkg.github.com/:_authToken': tokenReference,
      '//npm.pkg.github.com/:_auth': `prefix-${tokenReference}-suffix`,
      missing: missingReference,
      escaped: escapedReference,
    },
    { GH_PACKAGES_TOKEN: 'test-token' },
  )

  assert.deepStrictEqual(result, {
    '//npm.pkg.github.com/:_authToken': 'test-token',
    '//npm.pkg.github.com/:_auth': 'prefix-test-token-suffix',
    missing: missingReference,
    escaped: tokenReference,
  })
})

test('looks for a project .npmrc beside package.json and honors an explicit global config', () => {
  const packageJsonPath = join('workspace', 'project', 'package.json')
  const globalconfig = join('configuration', 'global.npmrc')

  const result = getNpmConfigReadOptions(packageJsonPath, {
    NPM_CONFIG_GLOBALCONFIG: globalconfig,
  })

  assert.deepStrictEqual(result, { cwd: dirname(packageJsonPath), globalconfig })
})

test(
  'uses npm default global config location on Windows',
  { skip: process.platform !== 'win32' },
  () => {
    const appData = join('C:', 'Users', 'test-user', 'AppData', 'Roaming')
    const result = getNpmConfigReadOptions(join('workspace', 'project', 'package.json'), {
      APPDATA: appData,
    })

    assert.strictEqual(result.globalconfig, join(appData, 'npm', 'etc', 'npmrc'))
  },
)
