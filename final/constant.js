const Scope = require('./deps/Scope')

const anonymousFuncName = '(anonymous)'

const commonCheckSymbol = symbol => arr =>
  Array.isArray(arr) && arr.at(-1) === symbol

const breakSymbol = Symbol('break')
const checkResult = result => result === breakSymbol

const memberSymbol = Symbol('member')
const checkMemberSymbol = commonCheckSymbol(memberSymbol)
const yieldSymbol = Symbol('yield')
const checkYieldSymbol = commonCheckSymbol(yieldSymbol)
const globalScope = new Scope('function', null)
globalScope.variables = globalThis
const tryBlockContinueSymbol = Symbol('tryBlockContinue')

module.exports = {
  anonymousFuncName,
  breakSymbol,
  checkResult,
  memberSymbol,
  checkMemberSymbol,
  yieldSymbol,
  checkYieldSymbol,
  tryBlockContinueSymbol,
  globalScope,
}
