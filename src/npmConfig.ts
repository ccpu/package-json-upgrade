import { dirname, join } from 'node:path'

import * as config from 'libnpmconfig'
import * as npmRegistryFetch from 'npm-registry-fetch'

import { getConfig } from './config'
import { Dict } from './types'

let skippedNpmConfigLastTime: boolean | undefined

const packageJsonPathToConfMap: Dict<string, npmRegistryFetch.Options> = {}

const environmentVariablePattern = /(?<!\\)(\\*)\$\{([^${}]+)\}/g

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

/** Expands `.npmrc` environment-variable references using npm's escaping semantics. */
export const expandNpmConfigEnvironmentVariables = (
  npmConfig: npmRegistryFetch.Options,
  environment: NodeJS.ProcessEnv = process.env,
): npmRegistryFetch.Options => {
  return Object.fromEntries(
    Object.entries(npmConfig).map(([key, value]) => {
      if (typeof value !== 'string') {
        return [key, value]
      }

      const expandedValue = value.replace(
        environmentVariablePattern,
        (originalValue, escapes: string, variableName: string) => {
          const environmentValue = environment[variableName] ?? `$\{${variableName}}`
          return escapes.length % 2 === 1
            ? originalValue.slice((escapes.length + 1) / 2)
            : escapes.slice(escapes.length / 2) + environmentValue
        },
      )
      return [key, expandedValue]
    }),
  ) as npmRegistryFetch.Options
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
      const npmConfig = config
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
      conf = expandNpmConfigEnvironmentVariables(npmConfig)
      packageJsonPathToConfMap[packageJsonPath] = conf
    }

    skippedNpmConfigLastTime = skipNpmConfig
  }
  return conf
}
