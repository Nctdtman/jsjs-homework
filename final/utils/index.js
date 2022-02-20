const { breakSymbol, checkMemberSymbol } = require('../constant')
function getKeys(tag) {
  const processedTag = tag.replace(/\[(.+?)\]/g, '.$1')
  const keys = processedTag.split('.')
  return keys
}

function get(obj, tag, getLast = false) {
  const keys = getKeys(tag)
  const last = getLast && keys.pop()
  const target = keys.reduce((p, k) => {
    // if (checkResult(p)) return p
    if (Reflect.has(p, k)) return p[k]
    return breakSymbol
  }, obj)
  return {
    target,
    last,
  }
}

function getValue(r, { noError = false, scope = null } = {}) {
  if (checkMemberSymbol(r)) {
    const [obj, prop] = r
    return obj[prop]
  }
  return scope ? scope.get(r, noError) : r
}

function once(fc, variable) {
  variable.isFirst ??= true
  const { isFirst } = variable
  if (isFirst) {
    fc()
    variable.isFirst = false
  }
}

function declareFunc(fc, name, length = 0) {
  Object.defineProperties(fc, {
    ...(length && { length: { value: length, configurable: true } }),
    name: {
      value: name,
      configurable: true,
    },
  })
}

module.exports = {
  get,
  getValue,
  once,
  declareFunc,
}
