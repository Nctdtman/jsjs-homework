const { customEval, Scope } = require('./eval')

const keys = ['deepEqual', 'true']
const t = keys.reduce((p, c) => ((p[c] = console.log), p), {})

const scope = new Scope()

customEval(
  `function get(){
  var a = 123;
  console.log(b);
}
  
get();`,
  scope,
)
