import hash from 'object-hash';

export function setCacheValue (task, result) {
  cache[hash({call: task.call, args: task.args, input: task.input})] = result.slice();
}

export function getCacheValue (task) {
  return cache[hash({call: task.call, args: task.args, input: task.input})];
}

const cache = {};
