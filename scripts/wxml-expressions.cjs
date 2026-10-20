const vm = require('node:vm');

// Check the JavaScript expressions only; this is not a WXML layout/compiler replacement.
function checkExpressions(template, filename) {
  let count = 0;
  for (const match of template.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    const line = template.slice(0, match.index).split('\n').length;
    try {
      new vm.Script('(' + match[1] + '\n)', { filename: filename + ':' + line });
    } catch (error) {
      throw new Error(`Invalid WXML expression at ${filename}:${line}: ${error.message}`);
    }
    count++;
  }
  return count;
}
module.exports = { checkExpressions };
