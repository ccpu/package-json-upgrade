import { dirname, join } from 'node:path'

import * as config from 'libnpmconfig'
import * as npmRegistryFetch from 'npm-registry-fetch'

import { getConfig } from './config'
import { Dict } from './types'

let skippedNpmConfigLastTime: boolean | undefined

const packageJsonPathToConfMap: Dict<string, npmRegistryFetch.Options> = {}

const getNpmConfigEnvironmentValue = (optionName: string, environment: NodeJS.ProcessEnv) => {
  return (
    environment[`npm_config_${optionName}`] ?? environment[`NPM_CONFIG_${optionName.toUpperCase()}`]
  )
}

const getGlobalNpmConfigPath = (environment: NodeJS.ProcessEnv, platform: NodeJS.Platform) => {
  const configuredPath = getNpmConfigEnvironmentValue('globalconfig', environment)
  if (configuredPath !== undefined) {
    return configuredPath
  }

  const prefix =
    getNpmConfigEnvironmentValue('prefix', environment) ??
    environment.PREFIX ??
    (platform === 'win32' && environment.APPDATA !== undefined
      ? join(environment.APPDATA, 'npm')
      : undefined)

  return prefix === undefined ? undefined : join(prefix, 'etc', 'npmrc')
}

/** Builds npm config lookup options for a package's project and global configuration files. */
export const getNpmConfigReadOptions = (
  packageJsonPath: string,
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
) => {
  const globalconfig = getGlobalNpmConfigPath(environment, platform)
  return globalconfig === undefined
    ? { cwd: dirname(packageJsonPath) }
    : { cwd: dirname(packageJsonPath), globalconfig }
}

export const getNpmConfig = (packageJsonPath: string): npmRegistryFetch.Options => {
  let conf = packageJsonPathToConfMap[packageJsonPath]
  const skipNpmConfig = getConfig().skipNpmConfig
  if (conf === undefined || skipNpmConfig !== skippedNpmConfigLastTime) {
    if (skipNpmConfig) {
      conf = {}
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      conf = config
        .read(
          {
            // here we can override config
            // currently disable cache since it seems to be buggy with npm-registry-fetch
            // the bug was supposedly fixed here: https://github.com/npm/npm-registry-fetch/issues/23
            // but I still have issues, and not enough time to investigate
            // TODO: Investigate why the cache causes issues
            cache: null,
            // registry: 'https://registry.npmjs.org',
          },
          getNpmConfigReadOptions(packageJsonPath),
        )
        .toJSON() as npmRegistryFetch.Options
      packageJsonPathToConfMap[packageJsonPath] = conf
    }

    skippedNpmConfigLastTime = skipNpmConfig
  }
  return conf
}
