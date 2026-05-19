const MAX_STACK = 40;

export function createUndoStack() {
  const stack = [];

  return {
    push(action) {
      stack.push(action);
      if (stack.length > MAX_STACK) stack.shift();
    },
    pop() {
      return stack.pop() || null;
    },
    canUndo() {
      return stack.length > 0;
    },
  };
}
