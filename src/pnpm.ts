import { LineCounter, Pair, Scalar, YAMLMap, isMap, isScalar, parseDocument } from 'yaml'
import type { DependencyGroups } from './dependency'

export const getPnpmWorkspaceDependencyInformation = (yamlAsString: string): DependencyGroups[] => {
  const lineCounter = new LineCounter()
  const ast = parseDocument(yamlAsString, { keepSourceTokens: true, lineCounter })

  const root = ast.contents

  if (!isMap<Scalar, YAMLMap>(root)) {
    throw new Error('unexpected type')
  }

  const catalog = root.items.find(
    (i: Pair<unknown, unknown>) => isScalar<string>(i.key) && i.key.value === 'catalog',
  )
  const catalogs = root.items.find(
    (i: Pair<unknown, unknown>) => isScalar<string>(i.key) && i.key.value === 'catalogs',
  )

  const dependencyGroups: Pair<unknown, unknown>[] = [...(catalog ? [catalog] : [])]

  if (catalogs?.value != null && isMap<Scalar, YAMLMap>(catalogs.value)) {
    catalogs.value.items.forEach((item: Pair<unknown, unknown>) => {
      if (!isMap<Scalar, YAMLMap>(item.value)) {
        throw new Error('unexpected type')
      }
      dependencyGroups.push(item)
    })
  }

  return dependencyGroups.map((a) => toDependencyGroup(a, lineCounter))
}

function toDependencyGroup(
  dependencyProperty: Pair<unknown, unknown>,
  lineCounter: LineCounter,
): DependencyGroups {
  if (!isMap<Scalar<string>, unknown>(dependencyProperty.value)) {
    throw new Error('unexpected type')
  }

  const offset = dependencyProperty.srcToken?.key?.offset

  if (offset == null) {
    throw new Error('unexpected type')
  }
  const { line: startLine } = lineCounter.linePos(offset)

  const dependencies = dependencyProperty.value.items.map((dep: Pair<unknown, unknown>) => {
    if (!isScalar<string>(dep.key)) {
      throw new Error('unexpected type')
    }

    if (!isScalar<string>(dep.value)) {
      throw new Error('unexpected type')
    }

    const offset = dep.srcToken?.key?.offset

    if (offset == null) {
      throw new Error('unexpected type')
    }
    const { line } = lineCounter.linePos(offset)

    return {
      dependencyName: dep.key.value,
      currentVersion: dep.value.value,
      line: line - 1,
    }
  })

  return {
    startLine: startLine - 1,
    deps: dependencies,
  }
}
