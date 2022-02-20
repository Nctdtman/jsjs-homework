const ForStatement = 'ForStatement'
const WhileStatement = 'WhileStatement'
const DoWhileStatement = 'DoWhileStatement'
const SwitchStatement = 'SwitchStatement'
// continue [label] => for/while
// break [label] => switch/for/while
const continueType = [ForStatement, WhileStatement, DoWhileStatement]
const breakType = [...continueType, SwitchStatement]

class RunTimeStack {
  constructor(...frames) {
    frames.forEach(frame => (frame.runTimeStack = this))
    this.stack = frames
    this.programResult = undefined
  }
  get alive() {
    return this.stack.length !== 0
  }
  add(frame) {
    frame.runTimeStack = this
    this.stack.push(frame)
  }
  top() {
    return this.stack.at(-1)
  }
  pop() {
    return this.stack.pop()
  }
  findRightIndex(findHandle = () => {}) {
    const len = this.stack.length
    for (let i = len - 1; i >= 0; i--) {
      const frame = this.stack[i]
      if (findHandle(frame, frame.node)) return i
    }
  }
  findRight(findHandle = () => {}) {
    const idx = this.findRightIndex(findHandle)
    return this.stack[idx]
  }
  findContinueFrame(label) {
    // for/while type frame -> * frame
    const findHandle = label
      ? frame => frame.label === label
      : (_, node) => continueType.includes(node.type)
    const idx = this.findRightIndex(findHandle) + 1
    if (Number.isNaN(idx)) {
      // try catch 里面没有外面的调用栈
      throw new Error('in try catch')
    }
    const frame = this.stack[idx]
    this.stack.length = idx + 1
    return frame
  }
  findBreakFrame(label) {
    const findHandle = label
      ? frame => frame.label === label
      : (_, node) => breakType.includes(node.type)
    const idx = this.findRightIndex(findHandle)
    const frame = this.stack[idx]
    this.stack.length = idx + 1
    return frame
  }
}
module.exports = RunTimeStack
