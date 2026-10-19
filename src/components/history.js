/**
 * Undo / Redo State Manager
 */

export class HistoryManager {
  constructor(maxHistory = 50) {
    this.maxHistory = maxHistory;
    this.undoStack = [];
    this.redoStack = [];
    this.onChange = null;
  }

  setListener(fn) {
    this.onChange = fn;
  }

  notify() {
    if (this.onChange) {
      this.onChange({
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoCount: this.undoStack.length,
        redoCount: this.redoStack.length
      });
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  push(currentState) {
    // Deep clone state to prevent reference mutation
    const snapshot = JSON.stringify(currentState);
    
    // Avoid pushing duplicate consecutive states
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snapshot) {
      return;
    }

    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // Any new action clears the redo stack
    this.redoStack = [];
    this.notify();
  }

  undo(currentState) {
    if (!this.canUndo()) return null;
    const previous = this.undoStack.pop();
    this.redoStack.push(JSON.stringify(currentState));
    this.notify();
    return JSON.parse(previous);
  }

  redo(currentState) {
    if (!this.canRedo()) return null;
    const next = this.redoStack.pop();
    this.undoStack.push(JSON.stringify(currentState));
    this.notify();
    return JSON.parse(next);
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}
