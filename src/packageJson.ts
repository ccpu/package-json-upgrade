import { findNodeAtLocation, Node, parseTree } from 'jsonc-parser'

import type { Dependency, DependencyGroups } from './dependency'

export const getPackageJsonDependencyInformation = (jsonAsString: string): DependencyGroups[] => {
  const tree = parseTree(jsonAsString)

  if (tree === undefined) {
    return []
  }

  const dependenciesNode = findNodeAtLocation(tree, ['dependencies'])
  const devDependenciesNode = findNodeAtLocation(tree, ['devDependencies'])

  return [dependenciesNode, devDependenciesNode]
    .filter((node): node is Node => node !== undefined)
    .map((node) => toDependencyGroup(jsonAsString, node))
}

function toDependencyGroup(jsonAsString: string, dependencyNode: Node): DependencyGroups {
  if (dependencyNode.type !== 'object' || !dependencyNode.children) {
    return { startLine: 0, deps: [] }
  }

  const deps = dependencyNode.children.map((property) => {
    if (property.type !== 'property' || !property.children || property.children.length < 2) {
      return null
    }

    const keyNode = property.children[0]
    const valueNode = property.children[1]

    if (keyNode.type !== 'string' || valueNode.type !== 'string') {
      return null
    }

    return {
      dependencyName: keyNode.value as string,
      currentVersion: valueNode.value as string,
      line: offsetToLine(jsonAsString, property.offset),
    }
  })

  return {
    startLine: offsetToLine(jsonAsString, dependencyNode.offset),
    deps: deps.filter((d): d is Dependency => d !== null),
  }
}

// jsonc-parser gives offset in characters, so we have to translate it to line numbers
// this currently does not respect CR-only line breaks... but no one uses that, right? Add it if someone complains.
function offsetToLine(text: string, offset: number): number {
  let line = 0
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++
    }
  }
  return line
}
