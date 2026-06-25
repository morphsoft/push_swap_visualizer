import type { OpToken, Stacks } from "./types";

function swapTop(stack: number[]): void {
  if (stack.length >= 2) {
    [stack[0], stack[1]] = [stack[1], stack[0]];
  }
}

function rotateUp(stack: number[]): void {
  if (stack.length >= 2) {
    const top = stack.shift()!;
    stack.push(top);
  }
}

function rotateDown(stack: number[]): void {
  if (stack.length >= 2) {
    const bottom = stack.pop()!;
    stack.unshift(bottom);
  }
}

function push(from: number[], to: number[]): void {
  if (from.length > 0) {
    to.unshift(from.shift()!);
  }
}

export function applyOp(stacks: Stacks, op: OpToken): void {
  switch (op) {
    case "sa": swapTop(stacks.a); break;
    case "sb": swapTop(stacks.b); break;
    case "ss": swapTop(stacks.a); swapTop(stacks.b); break;
    case "ra": rotateUp(stacks.a); break;
    case "rb": rotateUp(stacks.b); break;
    case "rr": rotateUp(stacks.a); rotateUp(stacks.b); break;
    case "rra": rotateDown(stacks.a); break;
    case "rrb": rotateDown(stacks.b); break;
    case "rrr": rotateDown(stacks.a); rotateDown(stacks.b); break;
    case "pa": push(stacks.b, stacks.a); break;
    case "pb": push(stacks.a, stacks.b); break;
  }
}

const SNAPSHOT_INTERVAL = 200;

function cloneStacks(s: Stacks): Stacks {
  return { a: [...s.a], b: [...s.b] };
}

export class Timeline {
  readonly length: number;
  private readonly ops: OpToken[];
  private readonly snapshots: Stacks[]; // snapshots[k] = state after k*SNAPSHOT_INTERVAL ops

  constructor(initialA: number[], ops: OpToken[]) {
    this.ops = ops;
    this.length = ops.length;
    this.snapshots = [];
    const work: Stacks = { a: [...initialA], b: [] };
    this.snapshots.push(cloneStacks(work));
    for (let i = 0; i < ops.length; i++) {
      applyOp(work, ops[i]);
      if ((i + 1) % SNAPSHOT_INTERVAL === 0) {
        this.snapshots.push(cloneStacks(work));
      }
    }
  }

  stateAt(index: number): Stacks {
    const clamped = Math.max(0, Math.min(index, this.length));
    const snapIdx = Math.floor(clamped / SNAPSHOT_INTERVAL);
    const state = cloneStacks(this.snapshots[snapIdx]);
    const start = snapIdx * SNAPSHOT_INTERVAL;
    for (let i = start; i < clamped; i++) {
      applyOp(state, this.ops[i]);
    }
    return state;
  }

  opAt(index: number): OpToken {
    return this.ops[index];
  }
}
