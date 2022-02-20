const acorn = require('acorn')

const {
  breakSymbol,
  checkResult,
  tryBlockContinueSymbol,
  memberSymbol,
  checkMemberSymbol,
  yieldSymbol,
  checkYieldSymbol,
  globalScope,
  anonymousFuncName,
} = require('./constant')
const { getValue, declareFunc } = require('./utils')
const { variableBoost } = require('./utils/variableBoost')
const Scope = require('./deps/Scope')
const RunTimeStack = require('./deps/RunTimeStack')
const Frame = require('./deps/Frame')

function customEval(code, parentScope = globalThis) {
  function evaluate(
    rootNode,
    scope,
    {
      self = undefined,
      defaultRunTimeStack = new RunTimeStack(
        new Frame(rootNode, scope, 'root'),
      ),
    } = {},
  ) {
    const runTimeStack = defaultRunTimeStack
    if (!runTimeStack.alive) {
      return undefined
    }
    code
    while (runTimeStack.alive) {
      const currFrame = runTimeStack.top()
      const { node, scope, variable } = currFrame
      const varBoost = () => variableBoost(node, variable, scope)
      function parseParams2Scope(scope, params, args) {
        variable.params ??= []
        for (let i = 0; i < params.length; i++) {
          const node = params[i]
          const result =
            node.type === 'Identifier' ? node.name : evaluate(node, scope)
          if (Array.isArray(result)) {
            const [name, defaultValue] = result
            scope.declare('var', name, args[i] ?? defaultValue)
          } else {
            scope.declare('var', result, args[i])
          }
        }
      }
      evalSwitch: switch (node.type) {
        case 'Program': {
          varBoost()
          const result = currFrame.getResultArr(node.body, scope, 'body')
          if (checkResult(result)) break
          currFrame.setResult(result.at(-1))
          break
        }
        case 'Literal': {
          currFrame.setResult(node.value)
          break
        }
        case 'Identifier': {
          const name = node.name
          const val = name !== 'undefined' ? scope.get(name) : undefined
          currFrame.setResult(val)
          break
        }
        case 'UnaryExpression': {
          const handleError = ['typeof'].includes(node.operator)
          let argument, argumentValue
          try {
            argument = evaluate(node.argument, scope)
            argumentValue = getValue(argument)
          } catch (e) {
            if (handleError) argumentValue = undefined
            else throw e
          }

          const operatorMap = {
            '+': () => +argumentValue,
            '-': () => -argumentValue,
            '~': () => ~argumentValue,
            '!': () => !argumentValue,
            void: () => void argumentValue,
            delete: () => {
              const [obj, prop] = argument
              return delete obj[prop]
            },
            typeof: () => typeof argumentValue,
          }
          if (!Reflect.has(operatorMap, node.operator))
            throw new Error(`${node.operator} operator is not support!`)
          const result = operatorMap[node.operator]()
          currFrame.setResult(result)
          break
        }
        case 'BinaryExpression': {
          let left = currFrame.getResult(node.left, scope, 'left')
          if (checkResult(left)) break
          let right = currFrame.getResult(node.right, scope, 'right')
          if (checkResult(right)) break

          left = getValue(left)
          right = getValue(right)
          // 可以用 generator 优化
          const operatorMap = {
            '|': () => left | right,
            '&': () => left & right,
            '<<': () => left << right,
            '>>': () => left >> right,
            '>>>': () => left >>> right,
            '+': () => left + right,
            '-': () => left - right,
            '/': () => left / right,
            '*': () => left * right,
            '**': () => left ** right,
            '%': () => left % right,
            '>': () => left > right,
            '>=': () => left >= right,
            '<': () => left < right,
            '<=': () => left <= right,
            '===': () => left === right,
          }
          if (!Reflect.has(operatorMap, node.operator))
            throw new Error(
              `${node.operator} BinaryExpression operator is not support!`,
            )

          let result = operatorMap[node.operator]()
          currFrame.setResult(result)
          break
        }
        case 'LogicalExpression': {
          const left = currFrame.getResult(node.left, scope, 'left')
          if (checkResult(left)) break
          const operatorMap = {
            '||'() {
              if (left) {
                return left
              } else {
                return currFrame.getResult(node.right, scope, 'right')
              }
            },
            '&&'() {
              if (left) {
                return currFrame.getResult(node.right, scope, 'right')
              } else return left
            },
          }
          if (!Reflect.has(operatorMap, node.operator))
            throw new Error(
              `${node.operator} LogicalExpression operator is not support!`,
            )

          let result = operatorMap[node.operator]()
          if (checkResult(result)) break
          currFrame.setResult(result)
          break
        }
        case 'IfStatement': {
          const test = currFrame.getResult(node.test, scope, 'test')
          if (checkResult(test)) break
          const target = test ? node.consequent : node.alternate
          if (target !== null) {
            const targetResult = currFrame.getResult(target, scope, 'target')
            if (checkResult(targetResult)) break
          }
          currFrame.setResult(undefined)
          break
        }
        case 'ConditionalExpression': {
          const test = currFrame.getResult(node.test, scope, 'test')
          if (checkResult(test)) break
          const target = test ? node.consequent : node.alternate
          const targetResult = currFrame.getResult(target, scope, 'target')
          if (checkResult(targetResult)) break
          currFrame.setResult(targetResult)
          break
        }
        case 'ObjectExpression': {
          variable.i ??= 0
          variable.result ??= {}
          const { i, result } = variable
          if (i < node.properties.length) {
            const property = node.properties[i]
            const { key, value, kind } = property
            const k = currFrame.getComputedName(key, scope, 'key' + i)
            if (checkResult(k)) break evalSwitch
            const v = currFrame.getResult(value, scope, 'value' + i)
            if (checkResult(v)) break evalSwitch
            if (typeof v === 'function' && v.name === anonymousFuncName) {
              declareFunc(v, k)
            }
            const descriptor = { configurable: true, enumerable: true }
            const valueDescriptor =
              kind === 'init'
                ? {
                    value: v,
                    writable: true,
                  }
                : {
                    [kind]: v,
                  }
            Object.defineProperty(result, k, {
              ...descriptor,
              ...valueDescriptor,
            })
            variable.i++
          } else {
            currFrame.setResult(result)
          }
          break
        }
        case 'ArrayExpression': {
          const arrResult = currFrame.getResultArr(node.elements, scope, 'arr')
          if (checkResult(arrResult)) break
          currFrame.setResult(arrResult)
          break
        }
        case 'CallExpression': {
          // 1. 解析函数
          const callee = currFrame.getResult(node.callee, scope, 'callee')
          if (checkResult(callee)) break
          // 2. 解析参数
          let args = currFrame.getResultArr(node.arguments, scope, 'args')
          if (checkResult(args)) break

          let result
          if (Array.isArray(callee)) {
            const [obj, prop] = callee
            result = obj[prop](...args)
          } else {
            result = callee(...args)
          }
          // 函数内部解析参数
          if (checkResult(result)) break
          currFrame.setResult(result)
          break
        }
        case 'UpdateExpression': {
          const origin = currFrame.getResult(node.argument, scope, 'origin')
          if (checkResult(origin)) break
          const arg = currFrame.getComputedName(node.argument, scope, 'name')
          if (checkResult(arg)) break
          const value = getValue(origin)
          const operatorMap = {
            '++': () => [value, value + 1],
            '--': () => [value, value - 1],
          }
          if (!Reflect.has(operatorMap, node.operator))
            throw new Error(`${node.operator} operator is not support!`)

          let [o, po] = operatorMap[node.operator]()
          scope.set(arg, po)
          if (node.prefix) {
            currFrame.setResult(po)
          } else {
            currFrame.setResult(o)
          }
          break
        }
        case 'ArrowFunctionExpression':
        case 'FunctionDeclaration':
        case 'FunctionExpression': {
          const isAsync = node.async
          const isGenerator = node.generator
          const fc = isGenerator
            ? function* (...args) {
                const functionScope = new Scope('function', scope)
                parseParams2Scope(functionScope, node.params, args)
                let result = evaluate(node.body, functionScope, {
                  self: this,
                })
                while (checkYieldSymbol(result)) {
                  const [value, run] = result
                  const arg = yield value
                  result = run(arg)
                }
                return result
              }
            : function (...args) {
                const functionScope = new Scope('function', scope)
                parseParams2Scope(functionScope, node.params, args)
                if (node.type !== 'ArrowFunctionExpression') {
                  functionScope.declare('var', 'new', { target: new.target })
                } else if (new.target) {
                  throw new TypeError(`${fc.name} is not a constructor`)
                }
                let result = evaluate(node.body, functionScope, {
                  self: node.type === 'ArrowFunctionExpression' ? self : this,
                })
                if (checkMemberSymbol(result)) {
                  result = getValue(result)
                }

                return isAsync ? Promise.resolve(result) : result
              }
          // const string = code.slice(node.start, node.end)
          // fc.toString = () => string
          const { id } = node

          if (id) {
            const name = id.name
            declareFunc(fc, name, node.params.length)
            scope.declare('let', name, fc)
          } else {
            declareFunc(fc, '(anonymous)', node.params.length)
          }
          currFrame.setResult(fc)
          break
        }
        case 'SequenceExpression': {
          const r = currFrame.getResultArr(node.expressions, scope, 'expresses')
          if (checkResult(r)) break
          currFrame.setResult(r.pop())
          break
        }
        case 'AssignmentExpression': {
          let left = currFrame.getComputedName(node.left, scope, 'left')
          if (checkResult(left)) break
          let right = currFrame.getResult(node.right, scope, 'right')
          if (checkResult(right)) break
          // string | value
          const operatorMap = {
            '='() {
              if (!Array.isArray(left)) {
                try {
                  scope.get(left)
                } catch {
                  scope.declare('var', left)
                }
              }
              if (checkMemberSymbol(right)) right = getValue(right)
              return scope.set(left, right)
            },
            '-='() {
              const origin = getValue(left, { scope })
              return scope.set(left, origin - right)
            },
            '+='() {
              const origin = getValue(left, { scope })
              return scope.set(left, origin + right)
            },
            '*='() {
              const origin = getValue(left, { scope })
              return scope.set(left, origin * right)
            },
            '%='() {
              const origin = getValue(left, { scope })
              return scope.set(left, origin % right)
            },
            '/='() {
              const origin = getValue(left, { scope })
              return scope.set(left, origin / right)
            },
          }
          if (!Reflect.has(operatorMap, node.operator))
            throw new Error(
              `${node.operator} AssignmentExpression operator is not support!`,
            )

          const r = operatorMap[node.operator]()
          if (checkResult(r)) break
          currFrame.setResult(r)
          break
        }
        case 'ForStatement': {
          variable.currScope ??= new Scope('block', scope)
          variable.i ??= 0
          const { i, currScope } = variable
          if (node.init) {
            const init = currFrame.getResult(node.init, currScope, 'init')
            if (checkResult(init)) break
          }
          const test = node.test
            ? currFrame.getResult(node.test, currScope, `test${i}`)
            : true
          if (checkResult(test)) break
          if (test) {
            const blockScope = new Scope('block', currScope, [currScope])
            currScope.copyVariablesTo(blockScope)
            const result = currFrame.getResult(
              node.body,
              blockScope,
              `forStatement-${i}`,
            )
            if (checkResult(result)) break
            if (node.update) {
              const update = currFrame.getResult(
                node.update,
                currScope,
                `update${i}`,
              )
              if (checkResult(update)) break
            }

            variable.i++
          } else {
            currFrame.setResult(undefined)
          }
          break
        }
        case 'TryStatement': {
          let result
          try {
            const tryBlockResult = evaluate(node.block, scope)
            if (tryBlockResult) result = tryBlockResult
          } catch (err) {
            const catchBlockScope = new Scope('block', scope)
            if (node.handler.param) {
              const param = node.handler.param.name
              catchBlockScope.declare('let', param, err)
            }
            const errBlockResult = evaluate(node.handler, catchBlockScope)
            if (errBlockResult) result = errBlockResult
          } finally {
            currFrame.setResult(undefined)
            if (node.finalizer) {
              const finalizerBlockResult = evaluate(node.finalizer, scope)
              if (finalizerBlockResult) result = finalizerBlockResult
            }
          }
          if (result) {
            if (Array.isArray(result)) {
              const [sym, label] = result
              if (sym === tryBlockContinueSymbol) {
                const targetFrame = runTimeStack.findContinueFrame(label)
                targetFrame.setResult(undefined)
              }
            } else {
              return result
            }
          }
          break
        }
        case 'CatchClause': {
          const r = currFrame.getResult(node.body, scope, 'r')
          if (checkResult(r)) break
          currFrame.setResult(undefined)
          break
        }
        case 'ThrowStatement': {
          const argument = currFrame.getResult(node.argument, scope, 'argument')
          if (checkResult(argument)) break
          throw argument
        }
        case 'DoWhileStatement':
        case 'WhileStatement': {
          variable.i ??= 0
          variable.first ??= node.type === 'DoWhileStatement'
          const { i, first } = variable
          const test =
            first || currFrame.getResult(node.test, scope, `test${i}`)
          if (checkResult(test)) break
          if (test) {
            const result = currFrame.getResult(node.body, scope, `r${i}`)
            if (checkResult(result)) break
            variable.i++
            if (first) {
              variable.first = false
            }
          } else {
            currFrame.setResult(undefined)
          }
          break
        }
        case 'SwitchStatement': {
          variable.switchScope ??= new Scope('block', scope)
          const discriminant = currFrame.getResult(
            node.discriminant,
            scope,
            'discriminant',
          )
          if (checkResult(discriminant)) break

          const defaultCase = node.cases.find(c => c.test === null)
          const otherCases = node.cases.filter(c => c !== defaultCase)
          const tests = currFrame.getResultArr(
            otherCases.map(({ test }) => test),
            variable.switchScope,
            'tests',
          )
          if (checkResult(tests)) break
          const matches = tests.map(test => test === discriminant)
          variable.i ??= matches.findIndex(match => match)
          const { i } = variable
          if (i !== -1 && i < otherCases.length) {
            const runCase = otherCases[i]
            const r = currFrame.getResult(
              runCase,
              variable.switchScope,
              `runCase-${i}`,
            )
            if (checkResult(r)) break
            variable.i++
          } else {
            if (defaultCase) {
              const r = currFrame.getResult(
                defaultCase,
                variable.switchScope,
                'defaultCaseResult',
              )
              if (checkResult(r)) break
            }
            currFrame.setResult(undefined)
          }
          break
        }
        case 'SwitchCase': {
          const consequent = currFrame.getResultArr(
            node.consequent,
            scope,
            'consequent',
          )
          if (checkResult(consequent)) break
          currFrame.setResult(undefined)
          break
        }
        case 'BreakStatement': {
          const label = node.label?.name
          const targetFrame = runTimeStack.findBreakFrame(label)
          targetFrame.setResult(undefined)
          break
        }
        case 'ContinueStatement': {
          const label = node.label?.name
          try {
            const targetFrame = runTimeStack.findContinueFrame(label)
            targetFrame.setResult(undefined)
          } catch {
            return [tryBlockContinueSymbol, label]
          }
          break
        }
        case 'LabeledStatement': {
          const label = node.label.name
          const body = currFrame.getResult(node.body, scope, 'labeled', label)
          if (checkResult(body)) break
          currFrame.setResult(undefined)
          break
        }
        case 'BlockStatement': {
          varBoost()
          variable.statementScope ??= new Scope('block', scope)
          const results = currFrame.getResultArr(
            node.body,
            variable.statementScope,
            'statement',
          )
          if (checkResult(results)) break
          currFrame.setResult(undefined)
          break
        }
        case 'ReturnStatement': {
          const result = currFrame.getResult(node.argument, scope, 'result')
          if (checkResult(result)) break
          return result
        }
        case 'ExpressionStatement': {
          const result = currFrame.getResult(node.expression, scope, 'result')
          if (checkResult(result)) break
          currFrame.setResult(result)
          break
        }
        case 'MemberExpression': {
          let object = currFrame.getResult(node.object, scope, 'object')
          if (checkResult(object)) break
          object = getValue(object)
          let property = node.computed
            ? currFrame.getResult(node.property, scope, 'property')
            : node.property.name

          if (checkResult(property)) break
          currFrame.setResult([object, property, memberSymbol])
          break
        }
        case 'NewExpression': {
          const newTarget = currFrame.getResult(node.callee, scope, 'newTarget')
          if (checkResult(newTarget)) break
          const args = currFrame.getResultArr(node.arguments, scope, 'args')
          if (checkResult(args)) break
          const result = new newTarget(...args)
          currFrame.setResult(result)
          break
        }
        case 'AwaitExpression': {
          const argument = currFrame.getResult(node.argument, scope, 'argument')
          if (checkResult(argument)) break
          return Promise.resolve(argument).then(v => {
            currFrame.setResult(v)
            return evaluate(null, scope, { defaultRunTimeStack: runTimeStack })
          })
        }
        case 'YieldExpression': {
          const argument = currFrame.getResult(node.argument, scope, 'argument')
          if (checkResult(argument)) break
          return [
            argument,
            v => {
              currFrame.setResult(v)
              return evaluate(null, scope, {
                defaultRunTimeStack: runTimeStack,
              })
            },
            yieldSymbol,
          ]
        }
        case 'VariableDeclaration': {
          variable.i ??= 0
          const { kind, declarations } = node
          if (variable.i < declarations.length) {
            const declarator = declarations[variable.i]
            const initResult =
              declarator.init === null
                ? undefined
                : currFrame.getResult(
                    declarator.init,
                    scope,
                    'init' + variable.i,
                  )
            if (checkResult(initResult)) break evalSwitch
            variable.i++
            const name = declarator.id.name
            if (
              typeof initResult === 'function' &&
              initResult.name === anonymousFuncName
            ) {
              declareFunc(initResult, name)
            }
            scope.declare(kind, name, initResult)
          } else {
            currFrame.setResult(undefined)
          }
          break
        }
        case 'AssignmentPattern': {
          const left = currFrame.getComputedName(node.left, scope, 'left')
          if (checkResult(left)) break
          const right = currFrame.getResult(node.right, scope, 'right')
          if (checkResult(right)) break
          currFrame.setResult([left, right])
          break
        }
        case 'ThisExpression': {
          currFrame.setResult(self)
          break
        }
        case 'MetaProperty': {
          const newTarget = scope.get('new').target
          currFrame.setResult(newTarget)
          break
        }
        default: {
          throw new Error(
            `Unsupported Syntax ${node.type} at Location ${node.start}:${node.end}`,
          )
        }
      }
    }
    return runTimeStack.programResult
  }
  const node = acorn.parse(code, {
    ecmaVersion: 'latest',
  })
  evaluate(node, parentScope)
  return parentScope.get('module').exports
}

class ExportScope {
  scope = new Scope('function', globalScope)

  constructor(variables = {}) {
    Object.assign(variables, {
      module: { exports: {} },
    })
    for (const [name, value] of Object.entries(variables)) {
      this.scope.declare('let', name, value)
    }
    return this.scope
  }
}
module.exports = { customEval, Scope: ExportScope }
