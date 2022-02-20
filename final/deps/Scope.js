class Scope {
  static DeclareSymbol = Symbol('declare')
  constructor(type, parent, syncScopes = []) {
    // function/block
    this.type = type
    this.parent = parent
    this.syncScopes = syncScopes
    this.variables = {}
  }
  copyVariablesTo(scope) {
    for (const n of Object.keys(this.variables)) {
      const { kind, value } = this.variables[n]
      scope.declare(kind, n, value)
    }
    return scope
  }
  declare(kind, name, value) {
    // kind -> var/let/const
    let currScope = this
    if (kind === 'var')
      while (currScope.type === 'block') currScope = currScope.parent
    if (Reflect.has(currScope.variables, name) && kind !== 'var') {
      throw new SyntaxError(`Identifier '${name}' has already been declared`)
    }
    currScope.variables[name] = {
      kind,
      value,
      [Scope.DeclareSymbol]: true,
    }
    return currScope
  }
  getTargetScope(name) {
    let currScope = this
    while (!Reflect.has(currScope.variables, name)) {
      if (!currScope.parent) {
        throw new Error(`${name} is not defined`)
      }
      currScope = currScope.parent
    }
    return currScope
  }
  get(name, noError = false) {
    try {
      const scope = this.getTargetScope(name)
      let result = scope.variables[name]
      // 兼容内置函数
      if (result[Scope.DeclareSymbol]) result = result.value
      return result
    } catch (err) {
      if (noError) return undefined
      else throw err
    }
  }
  set(name, value) {
    if (Array.isArray(name)) {
      const [obj, prop] = name
      return (obj[prop] = value)
    }
    const scope = this.getTargetScope(name)
    const result = scope.variables[name]
    if (result.kind === 'const') {
      throw new TypeError(`Assignment to constant variable`)
    }
    scope.syncScopes.forEach(s => s.set(name, value))
    return (result.value = value)
  }
}

module.exports = Scope
