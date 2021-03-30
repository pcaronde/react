/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

type Heap = Array<Node>;
type Node = {|
  id: number,
  sortIndex: number,
|};

export function push(heap: Heap, node: Node): void {
  const index = heap.length;
  heap.push(node);
  siftUp(heap, node, index);
}

export function peek(heap: Heap): Node | null {
  return heap.length === 0 ? null : heap[0];
}

export function pop(heap: Heap): Node | null {
  if (heap.length === 0) {
    return null;
  }
  const first = heap[0];

  const last = heap.pop();

  if (last !== first) {
    heap[0] = last;
    siftDown(heap, last, 0);
  }

  return first;
}

function siftUp(heap, node, i) {
  let index = i;

  while (index > 0) {
    const parentIndex = (index - 1) >>> 1;
    const parent = heap[parentIndex];

    if (compare(parent, node) < 0) {
      break;
    }
    swap(heap, parentIndex, index);
    index = parentIndex;
  }
}

function siftDown(heap, node, i) {
  let index = i;
  const halfLength = heap.length >>> 1;

  while (index < halfLength) {
    let bestIndex = index * 2 + 1;
    const rightIndex = index * 2 + 2;

    // If the right node is smaller, swap with the smaller of those.
    if (
      heap.length > rightIndex &&
      compare(heap[rightIndex], heap[bestIndex]) < 0
    ) {
      bestIndex = rightIndex;
    }

    if (compare(node, heap[bestIndex]) < 0) {
      break;
    }

    swap(heap, bestIndex, index);
    index = bestIndex;
  }
}

function swap(heap, left, right) {
  const item = heap[left];
  heap[left] = heap[right];
  heap[right] = item;
}

function compare(a, b) {
  // Compare sort index first, then task id.
  const diff = a.sortIndex - b.sortIndex;
  return diff !== 0 ? diff : a.id - b.id;
}
