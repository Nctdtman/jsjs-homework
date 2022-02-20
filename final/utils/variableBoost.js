const Scope = require('../deps/Scope')
const { once } = require('.')
/**
 * @param {Scope} scope
 */
function variableBoostVar(node, scope) {
  if (node.kind !== 'var') return
  const { declarations } = node
  for (const declaration of declarations) {
    const { id } = declaration
    scope.declare('var', id.name, undefined)
  }
}
/**
 * @param {Scope} scope
 */
function variableBoostBlock(rootNode, scope) {
  const { body } = rootNode
  if (!body) return
  rootNode.body.sort(node => {
    if (node.type === 'FunctionDeclaration') {
      return -1
    }
    if (node.type === 'VariableDeclaration') {
      variableBoostVar(node, scope)
    }
    return 0
  })
}

function variableBoost(rootNode, variable, scope) {
  once(() => variableBoostBlock(rootNode, scope), variable)
}
module.exports = { variableBoost }
