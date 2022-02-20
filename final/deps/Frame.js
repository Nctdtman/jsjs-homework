const { get } = require('../utils')
const { breakSymbol, checkResult } = require('../constant')

class Frame {
  constructor(node, scope, tag, label = null) {
    this.node = node
    this.scope = scope
    this.tag = tag
    this.label = label
    this.variable = {}
    this.runTimeStack = null
  }
  setResult(result) {
    this.runTimeStack.pop()
    if (!this.runTimeStack.alive) {
      this.runTimeStack.programResult = result
      return
    }
    const frame = this.runTimeStack.top()
    const { variable } = frame
    const { target, last } = get(variable, this.tag, true)
    target[last] = result
  }
  getResult(node, scope, tag, label = null) {
    const { target } = get(this.variable, tag)
    if (checkResult(target)) {
      this.runTimeStack.add(new Frame(node, scope, tag, label))
    }
    return target
  }
  getResultArr(nodes, scope, tag) {
    if (nodes.length === 0) return []
    const { target, last } = get(this.variable, tag, true)
    target[last] ??= []
    const keyI = `${last}i`
    this.variable[keyI] ??= 0
    const { [keyI]: i } = this.variable
    if (i >= nodes.length) return get(this.variable, tag).target

    const node = nodes[i]
    const r = this.getResult(node, scope, `${tag}[${i}]`)
    if (checkResult(r)) return breakSymbol
    this.variable[keyI]++
    return breakSymbol
  }
  getComputedName(node, scope, tag) {
    return node.type === 'Identifier'
      ? node.name
      : this.getResult(node, scope, tag)
  }
}

module.exports = Frame
