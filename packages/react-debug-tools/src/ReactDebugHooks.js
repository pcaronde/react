/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {
  Awaited,
  ReactContext,
  StartTransitionOptions,
  Usable,
  Thenable,
  ReactDebugInfo,
} from 'shared/ReactTypes';
import type {
  Fiber,
  Dispatcher as DispatcherType,
} from 'react-reconciler/src/ReactInternalTypes';

import ErrorStackParser from 'error-stack-parser';
import assign from 'shared/assign';
import ReactSharedInternals from 'shared/ReactSharedInternals';
import {
  FunctionComponent,
  SimpleMemoComponent,
  ContextProvider,
  ForwardRef,
} from 'react-reconciler/src/ReactWorkTags';
import {
  REACT_MEMO_CACHE_SENTINEL,
  REACT_CONTEXT_TYPE,
} from 'shared/ReactSymbols';

type CurrentDispatcherRef = typeof ReactSharedInternals.ReactCurrentDispatcher;

// Used to track hooks called during a render

type HookLogEntry = {
  displayName: string | null,
  primitive: string,
  stackError: Error,
  value: mixed,
  debugInfo: ReactDebugInfo | null,
};

let hookLog: Array<HookLogEntry> = [];

// Primitives

type BasicStateAction<S> = (S => S) | S;

type Dispatch<A> = A => void;

let primitiveStackCache: null | Map<string, Array<any>> = null;

type Hook = {
  memoizedState: any,
  next: Hook | null,
};

function getPrimitiveStackCache(): Map<string, Array<any>> {
  // This initializes a cache of all primitive hooks so that the top
  // most stack frames added by calling the primitive hook can be removed.
  if (primitiveStackCache === null) {
    const cache = new Map<string, Array<any>>();
    let readHookLog;
    try {
      // Use all hooks here to add them to the hook log.
      Dispatcher.useContext(({_currentValue: null}: any));
      Dispatcher.useState(null);
      Dispatcher.useReducer((s: mixed, a: mixed) => s, null);
      Dispatcher.useRef(null);
      if (typeof Dispatcher.useCacheRefresh === 'function') {
        // This type check is for Flow only.
        Dispatcher.useCacheRefresh();
      }
      Dispatcher.useLayoutEffect(() => {});
      Dispatcher.useInsertionEffect(() => {});
      Dispatcher.useEffect(() => {});
      Dispatcher.useImperativeHandle(undefined, () => null);
      Dispatcher.useDebugValue(null);
      Dispatcher.useCallback(() => {});
      Dispatcher.useTransition();
      Dispatcher.useSyncExternalStore(
        () => () => {},
        () => null,
        () => null,
      );
      Dispatcher.useDeferredValue(null);
      Dispatcher.useMemo(() => null);
      if (typeof Dispatcher.useMemoCache === 'function') {
        // This type check is for Flow only.
        Dispatcher.useMemoCache(0);
      }
      if (typeof Dispatcher.useOptimistic === 'function') {
        // This type check is for Flow only.
        Dispatcher.useOptimistic(null, (s: mixed, a: mixed) => s);
      }
      if (typeof Dispatcher.useFormState === 'function') {
        // This type check is for Flow only.
        Dispatcher.useFormState((s: mixed, p: mixed) => s, null);
      }
      if (typeof Dispatcher.use === 'function') {
        // This type check is for Flow only.
        Dispatcher.use(
          ({
            $$typeof: REACT_CONTEXT_TYPE,
            _currentValue: null,
          }: any),
        );
        Dispatcher.use({
          then() {},
          status: 'fulfilled',
          value: null,
        });
        try {
          Dispatcher.use(
            ({
              then() {},
            }: any),
          );
        } catch (x) {}
      }
    } finally {
      readHookLog = hookLog;
      hookLog = [];
    }
    for (let i = 0; i < readHookLog.length; i++) {
      const hook = readHookLog[i];
      cache.set(hook.primitive, ErrorStackParser.parse(hook.stackError));
    }
    primitiveStackCache = cache;
  }
  return primitiveStackCache;
}

let currentFiber: null | Fiber = null;
let currentHook: null | Hook = null;

function nextHook(): null | Hook {
  const hook = currentHook;
  if (hook !== null) {
    currentHook = hook.next;
  }
  return hook;
}

function readContext<T>(context: ReactContext<T>): T {
  // For now we don't expose readContext usage in the hooks debugging info.
  return context._currentValue;
}

const SuspenseException: mixed = new Error(
  "Suspense Exception: This is not a real error! It's an implementation " +
    'detail of `use` to interrupt the current render. You must either ' +
    'rethrow it immediately, or move the `use` call outside of the ' +
    '`try/catch` block. Capturing without rethrowing will lead to ' +
    'unexpected behavior.\n\n' +
    'To handle async errors, wrap your component in an error boundary, or ' +
    "call the promise's `.catch` method and pass the result to `use`",
);

function use<T>(usable: Usable<T>): T {
  if (usable !== null && typeof usable === 'object') {
    // $FlowFixMe[method-unbinding]
    if (typeof usable.then === 'function') {
      const thenable: Thenable<any> = (usable: any);
      switch (thenable.status) {
        case 'fulfilled': {
          const fulfilledValue: T = thenable.value;
          hookLog.push({
            displayName: null,
            primitive: 'Promise',
            stackError: new Error(),
            value: fulfilledValue,
            debugInfo:
              thenable._debugInfo === undefined ? null : thenable._debugInfo,
          });
          return fulfilledValue;
        }
        case 'rejected': {
          const rejectedError = thenable.reason;
          throw rejectedError;
        }
      }
      // If this was an uncached Promise we have to abandon this attempt
      // but we can still emit anything up until this point.
      hookLog.push({
        displayName: null,
        primitive: 'Unresolved',
        stackError: new Error(),
        value: thenable,
        debugInfo:
          thenable._debugInfo === undefined ? null : thenable._debugInfo,
      });
      throw SuspenseException;
    } else if (usable.$$typeof === REACT_CONTEXT_TYPE) {
      const context: ReactContext<T> = (usable: any);
      const value = readContext(context);

      hookLog.push({
        displayName: context.displayName || 'Context',
        primitive: 'Context (use)',
        stackError: new Error(),
        value,
        debugInfo: null,
      });

      return value;
    }
  }

  // eslint-disable-next-line react-internal/safe-string-coercion
  throw new Error('An unsupported type was passed to use(): ' + String(usable));
}

function useContext<T>(context: ReactContext<T>): T {
  hookLog.push({
    displayName: context.displayName || null,
    primitive: 'Context',
    stackError: new Error(),
    value: context._currentValue,
    debugInfo: null,
  });
  return context._currentValue;
}

function useState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  const hook = nextHook();
  const state: S =
    hook !== null
      ? hook.memoizedState
      : typeof initialState === 'function'
      ? // $FlowFixMe[incompatible-use]: Flow doesn't like mixed types
        initialState()
      : initialState;
  hookLog.push({
    displayName: null,
    primitive: 'State',
    stackError: new Error(),
    value: state,
    debugInfo: null,
  });
  return [state, (action: BasicStateAction<S>) => {}];
}

function useReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: I => S,
): [S, Dispatch<A>] {
  const hook = nextHook();
  let state;
  if (hook !== null) {
    state = hook.memoizedState;
  } else {
    state = init !== undefined ? init(initialArg) : ((initialArg: any): S);
  }
  hookLog.push({
    displayName: null,
    primitive: 'Reducer',
    stackError: new Error(),
    value: state,
    debugInfo: null,
  });
  return [state, (action: A) => {}];
}

function useRef<T>(initialValue: T): {current: T} {
  const hook = nextHook();
  const ref = hook !== null ? hook.memoizedState : {current: initialValue};
  hookLog.push({
    displayName: null,
    primitive: 'Ref',
    stackError: new Error(),
    value: ref.current,
    debugInfo: null,
  });
  return ref;
}

function useCacheRefresh(): () => void {
  const hook = nextHook();
  hookLog.push({
    displayName: null,
    primitive: 'CacheRefresh',
    stackError: new Error(),
    value: hook !== null ? hook.memoizedState : function refresh() {},
    debugInfo: null,
  });
  return () => {};
}

function useLayoutEffect(
  create: () => (() => void) | void,
  inputs: Array<mixed> | void | null,
): void {
  nextHook();
  hookLog.push({
    displayName: null,
    primitive: 'LayoutEffect',
    stackError: new Error(),
    value: create,
    debugInfo: null,
  });
}

function useInsertionEffect(
  create: () => mixed,
  inputs: Array<mixed> | void | null,
): void {
  nextHook();
  hookLog.push({
    displayName: null,
    primitive: 'InsertionEffect',
    stackError: new Error(),
    value: create,
    debugInfo: null,
  });
}

function useEffect(
  create: () => (() => void) | void,
  inputs: Array<mixed> | void | null,
): void {
  nextHook();
  hookLog.push({
    displayName: null,
    primitive: 'Effect',
    stackError: new Error(),
    value: create,
    debugInfo: null,
  });
}

function useImperativeHandle<T>(
  ref: {current: T | null} | ((inst: T | null) => mixed) | null | void,
  create: () => T,
  inputs: Array<mixed> | void | null,
): void {
  nextHook();
  // We don't actually store the instance anywhere if there is no ref callback
  // and if there is a ref callback it might not store it but if it does we
  // have no way of knowing where. So let's only enable introspection of the
  // ref itself if it is using the object form.
  let instance: ?T = undefined;
  if (ref !== null && typeof ref === 'object') {
    instance = ref.current;
  }
  hookLog.push({
    displayName: null,
    primitive: 'ImperativeHandle',
    stackError: new Error(),
    value: instance,
    debugInfo: null,
  });
}

function useDebugValue(value: any, formatterFn: ?(value: any) => any) {
  hookLog.push({
    displayName: null,
    primitive: 'DebugValue',
    stackError: new Error(),
    value: typeof formatterFn === 'function' ? formatterFn(value) : value,
    debugInfo: null,
  });
}

function useCallback<T>(callback: T, inputs: Array<mixed> | void | null): T {
  const hook = nextHook();
  hookLog.push({
    displayName: null,
    primitive: 'Callback',
    stackError: new Error(),
    value: hook !== null ? hook.memoizedState[0] : callback,
    debugInfo: null,
  });
  return callback;
}

function useMemo<T>(
  nextCreate: () => T,
  inputs: Array<mixed> | void | null,
): T {
  const hook = nextHook();
  const value = hook !== null ? hook.memoizedState[0] : nextCreate();
  hookLog.push({
    displayName: null,
    primitive: 'Memo',
    stackError: new Error(),
    value,
    debugInfo: null,
  });
  return value;
}

function useSyncExternalStore<T>(
  subscribe: (() => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): T {
  // useSyncExternalStore() composes multiple hooks internally.
  // Advance the current hook index the same number of times
  // so that subsequent hooks have the right memoized state.
  nextHook(); // SyncExternalStore
  nextHook(); // Effect
  const value = getSnapshot();
  hookLog.push({
    displayName: null,
    primitive: 'SyncExternalStore',
    stackError: new Error(),
    value,
    debugInfo: null,
  });
  return value;
}

function useTransition(): [
  boolean,
  (callback: () => void, options?: StartTransitionOptions) => void,
] {
  // useTransition() composes multiple hooks internally.
  // Advance the current hook index the same number of times
  // so that subsequent hooks have the right memoized state.
  const stateHook = nextHook();
  nextHook(); // Callback

  const isPending = stateHook !== null ? stateHook.memoizedState : false;

  hookLog.push({
    displayName: null,
    primitive: 'Transition',
    stackError: new Error(),
    value: isPending,
    debugInfo: null,
  });
  return [isPending, () => {}];
}

function useDeferredValue<T>(value: T, initialValue?: T): T {
  const hook = nextHook();
  const prevValue = hook !== null ? hook.memoizedState : value;
  hookLog.push({
    displayName: null,
    primitive: 'DeferredValue',
    stackError: new Error(),
    value: prevValue,
    debugInfo: null,
  });
  return prevValue;
}

function useId(): string {
  const hook = nextHook();
  const id = hook !== null ? hook.memoizedState : '';
  hookLog.push({
    displayName: null,
    primitive: 'Id',
    stackError: new Error(),
    value: id,
    debugInfo: null,
  });
  return id;
}

// useMemoCache is an implementation detail of Forget's memoization
// it should not be called directly in user-generated code
function useMemoCache(size: number): Array<any> {
  const fiber = currentFiber;
  // Don't throw, in case this is called from getPrimitiveStackCache
  if (fiber == null) {
    return [];
  }

  // $FlowFixMe[incompatible-use]: updateQueue is mixed
  const memoCache = fiber.updateQueue?.memoCache;
  if (memoCache == null) {
    return [];
  }

  let data = memoCache.data[memoCache.index];
  if (data === undefined) {
    data = memoCache.data[memoCache.index] = new Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = REACT_MEMO_CACHE_SENTINEL;
    }
  }

  // We don't write anything to hookLog on purpose, so this hook remains invisible to users.

  memoCache.index++;
  return data;
}

function useOptimistic<S, A>(
  passthrough: S,
  reducer: ?(S, A) => S,
): [S, (A) => void] {
  const hook = nextHook();
  let state;
  if (hook !== null) {
    state = hook.memoizedState;
  } else {
    state = passthrough;
  }
  hookLog.push({
    displayName: null,
    primitive: 'Optimistic',
    stackError: new Error(),
    value: state,
    debugInfo: null,
  });
  return [state, (action: A) => {}];
}

function useFormState<S, P>(
  action: (Awaited<S>, P) => S,
  initialState: Awaited<S>,
  permalink?: string,
): [Awaited<S>, (P) => void, boolean] {
  const hook = nextHook(); // FormState
  nextHook(); // PendingState
  nextHook(); // ActionQueue
  const stackError = new Error();
  let value;
  let debugInfo = null;
  let error = null;

  if (hook !== null) {
    const actionResult = hook.memoizedState;
    if (
      typeof actionResult === 'object' &&
      actionResult !== null &&
      // $FlowFixMe[method-unbinding]
      typeof actionResult.then === 'function'
    ) {
      const thenable: Thenable<Awaited<S>> = (actionResult: any);
      switch (thenable.status) {
        case 'fulfilled': {
          value = thenable.value;
          debugInfo =
            thenable._debugInfo === undefined ? null : thenable._debugInfo;
          break;
        }
        case 'rejected': {
          const rejectedError = thenable.reason;
          error = rejectedError;
          break;
        }
        default:
          // If this was an uncached Promise we have to abandon this attempt
          // but we can still emit anything up until this point.
          error = SuspenseException;
          debugInfo =
            thenable._debugInfo === undefined ? null : thenable._debugInfo;
          value = thenable;
      }
    } else {
      value = (actionResult: any);
    }
  } else {
    value = initialState;
  }

  hookLog.push({
    displayName: null,
    primitive: 'FormState',
    stackError: stackError,
    value: value,
    debugInfo: debugInfo,
  });

  if (error !== null) {
    throw error;
  }

  // value being a Thenable is equivalent to error being not null
  // i.e. we only reach this point with Awaited<S>
  const state = ((value: any): Awaited<S>);

  // TODO: support displaying pending value
  return [state, (payload: P) => {}, false];
}

const Dispatcher: DispatcherType = {
  use,
  readContext,
  useCacheRefresh,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useDebugValue,
  useLayoutEffect,
  useInsertionEffect,
  useMemo,
  useMemoCache,
  useOptimistic,
  useReducer,
  useRef,
  useState,
  useTransition,
  useSyncExternalStore,
  useDeferredValue,
  useId,
  useFormState,
};

// create a proxy to throw a custom error
// in case future versions of React adds more hooks
const DispatcherProxyHandler = {
  get(target: DispatcherType, prop: string) {
    if (target.hasOwnProperty(prop)) {
      return target[prop];
    }
    const error = new Error('Missing method in Dispatcher: ' + prop);
    // Note: This error name needs to stay in sync with react-devtools-shared
    // TODO: refactor this if we ever combine the devtools and debug tools packages
    error.name = 'ReactDebugToolsUnsupportedHookError';
    throw error;
  },
};

// `Proxy` may not exist on some platforms
const DispatcherProxy =
  typeof Proxy === 'undefined'
    ? Dispatcher
    : new Proxy(Dispatcher, DispatcherProxyHandler);

// Inspect

export type HookSource = {
  lineNumber: number | null,
  columnNumber: number | null,
  fileName: string | null,
  functionName: string | null,
};

export type HooksNode = {
  id: number | null,
  isStateEditable: boolean,
  name: string,
  value: mixed,
  subHooks: Array<HooksNode>,
  debugInfo: null | ReactDebugInfo,
  hookSource: null | HookSource,
};
export type HooksTree = Array<HooksNode>;

// Don't assume
//
// We can't assume that stack frames are nth steps away from anything.
// E.g. we can't assume that the root call shares all frames with the stack
// of a hook call. A simple way to demonstrate this is wrapping `new Error()`
// in a wrapper constructor like a polyfill. That'll add an extra frame.
// Similar things can happen with the call to the dispatcher. The top frame
// may not be the primitive. Likewise the primitive can have fewer stack frames
// such as when a call to useState got inlined to use dispatcher.useState.
//
// We also can't assume that the last frame of the root call is the same
// frame as the last frame of the hook call because long stack traces can be
// truncated to a stack trace limit.

let mostLikelyAncestorIndex = 0;

function findSharedIndex(hookStack: any, rootStack: any, rootIndex: number) {
  const source = rootStack[rootIndex].source;
  hookSearch: for (let i = 0; i < hookStack.length; i++) {
    if (hookStack[i].source === source) {
      // This looks like a match. Validate that the rest of both stack match up.
      for (
        let a = rootIndex + 1, b = i + 1;
        a < rootStack.length && b < hookStack.length;
        a++, b++
      ) {
        if (hookStack[b].source !== rootStack[a].source) {
          // If not, give up and try a different match.
          continue hookSearch;
        }
      }
      return i;
    }
  }
  return -1;
}

function findCommonAncestorIndex(rootStack: any, hookStack: any) {
  let rootIndex = findSharedIndex(
    hookStack,
    rootStack,
    mostLikelyAncestorIndex,
  );
  if (rootIndex !== -1) {
    return rootIndex;
  }
  // If the most likely one wasn't a hit, try any other frame to see if it is shared.
  // If that takes more than 5 frames, something probably went wrong.
  for (let i = 0; i < rootStack.length && i < 5; i++) {
    rootIndex = findSharedIndex(hookStack, rootStack, i);
    if (rootIndex !== -1) {
      mostLikelyAncestorIndex = i;
      return rootIndex;
    }
  }
  return -1;
}

function isReactWrapper(functionName: any, primitiveName: string) {
  if (!functionName) {
    return false;
  }
  switch (primitiveName) {
    case 'Context':
    case 'Context (use)':
    case 'Promise':
    case 'Unresolved':
      if (functionName.endsWith('use')) {
        return true;
      }
  }
  const expectedPrimitiveName = 'use' + primitiveName;
  if (functionName.length < expectedPrimitiveName.length) {
    return false;
  }
  return (
    functionName.lastIndexOf(expectedPrimitiveName) ===
    functionName.length - expectedPrimitiveName.length
  );
}

function findPrimitiveIndex(hookStack: any, hook: HookLogEntry) {
  const stackCache = getPrimitiveStackCache();
  const primitiveStack = stackCache.get(hook.primitive);
  if (primitiveStack === undefined) {
    return -1;
  }
  for (let i = 0; i < primitiveStack.length && i < hookStack.length; i++) {
    if (primitiveStack[i].source !== hookStack[i].source) {
      // If the next two frames are functions called `useX` then we assume that they're part of the
      // wrappers that the React packager or other packages adds around the dispatcher.
      if (
        i < hookStack.length - 1 &&
        isReactWrapper(hookStack[i].functionName, hook.primitive)
      ) {
        i++;
      }
      if (
        i < hookStack.length - 1 &&
        isReactWrapper(hookStack[i].functionName, hook.primitive)
      ) {
        i++;
      }
      return i;
    }
  }
  return -1;
}

function parseTrimmedStack(rootStack: any, hook: HookLogEntry) {
  // Get the stack trace between the primitive hook function and
  // the root function call. I.e. the stack frames of custom hooks.
  const hookStack = ErrorStackParser.parse(hook.stackError);
  const rootIndex = findCommonAncestorIndex(rootStack, hookStack);
  const primitiveIndex = findPrimitiveIndex(hookStack, hook);
  if (
    rootIndex === -1 ||
    primitiveIndex === -1 ||
    rootIndex - primitiveIndex < 2
  ) {
    // Something went wrong. Give up.
    return null;
  }
  return hookStack.slice(primitiveIndex, rootIndex - 1);
}

function parseCustomHookName(functionName: void | string): string {
  if (!functionName) {
    return '';
  }
  let startIndex = functionName.lastIndexOf('.');
  if (startIndex === -1) {
    startIndex = 0;
  }
  if (functionName.slice(startIndex, startIndex + 3) === 'use') {
    startIndex += 3;
  }
  return functionName.slice(startIndex);
}

function buildTree(
  rootStack: any,
  readHookLog: Array<HookLogEntry>,
): HooksTree {
  const rootChildren: Array<HooksNode> = [];
  let prevStack = null;
  let levelChildren = rootChildren;
  let nativeHookID = 0;
  const stackOfChildren = [];
  for (let i = 0; i < readHookLog.length; i++) {
    const hook = readHookLog[i];
    const stack = parseTrimmedStack(rootStack, hook);
    if (stack !== null) {
      // Note: The indices 0 <= n < length-1 will contain the names.
      // The indices 1 <= n < length will contain the source locations.
      // That's why we get the name from n - 1 and don't check the source
      // of index 0.
      let commonSteps = 0;
      if (prevStack !== null) {
        // Compare the current level's stack to the new stack.
        while (commonSteps < stack.length && commonSteps < prevStack.length) {
          const stackSource = stack[stack.length - commonSteps - 1].source;
          const prevSource =
            prevStack[prevStack.length - commonSteps - 1].source;
          if (stackSource !== prevSource) {
            break;
          }
          commonSteps++;
        }
        // Pop back the stack as many steps as were not common.
        for (let j = prevStack.length - 1; j > commonSteps; j--) {
          levelChildren = stackOfChildren.pop();
        }
      }
      // The remaining part of the new stack are custom hooks. Push them
      // to the tree.
      for (let j = stack.length - commonSteps - 1; j >= 1; j--) {
        const children: Array<HooksNode> = [];
        const stackFrame = stack[j];
        const levelChild: HooksNode = {
          id: null,
          isStateEditable: false,
          name: parseCustomHookName(stack[j - 1].functionName),
          value: undefined,
          subHooks: children,
          debugInfo: null,
          hookSource: {
            lineNumber: stackFrame.lineNumber,
            columnNumber: stackFrame.columnNumber,
            functionName: stackFrame.functionName,
            fileName: stackFrame.fileName,
          },
        };

        levelChildren.push(levelChild);
        stackOfChildren.push(levelChildren);
        levelChildren = children;
      }
      prevStack = stack;
    }
    const {displayName, primitive, debugInfo} = hook;

    // For now, the "id" of stateful hooks is just the stateful hook index.
    // Custom hooks have no ids, nor do non-stateful native hooks (e.g. Context, DebugValue).
    const id =
      primitive === 'Context' ||
      primitive === 'Context (use)' ||
      primitive === 'DebugValue' ||
      primitive === 'Promise' ||
      primitive === 'Unresolved'
        ? null
        : nativeHookID++;

    // For the time being, only State and Reducer hooks support runtime overrides.
    const isStateEditable = primitive === 'Reducer' || primitive === 'State';
    const name = displayName || primitive;
    const levelChild: HooksNode = {
      id,
      isStateEditable,
      name: name,
      value: hook.value,
      subHooks: [],
      debugInfo: debugInfo,
      hookSource: null,
    };

    const hookSource: HookSource = {
      lineNumber: null,
      functionName: null,
      fileName: null,
      columnNumber: null,
    };
    if (stack && stack.length >= 1) {
      const stackFrame = stack[0];
      hookSource.lineNumber = stackFrame.lineNumber;
      hookSource.functionName = stackFrame.functionName;
      hookSource.fileName = stackFrame.fileName;
      hookSource.columnNumber = stackFrame.columnNumber;
    }

    levelChild.hookSource = hookSource;

    levelChildren.push(levelChild);
  }

  // Associate custom hook values (useDebugValue() hook entries) with the correct hooks.
  processDebugValues(rootChildren, null);

  return rootChildren;
}

// Custom hooks support user-configurable labels (via the special useDebugValue() hook).
// That hook adds user-provided values to the hooks tree,
// but these values aren't intended to appear alongside of the other hooks.
// Instead they should be attributed to their parent custom hook.
// This method walks the tree and assigns debug values to their custom hook owners.
function processDebugValues(
  hooksTree: HooksTree,
  parentHooksNode: HooksNode | null,
): void {
  const debugValueHooksNodes: Array<HooksNode> = [];

  for (let i = 0; i < hooksTree.length; i++) {
    const hooksNode = hooksTree[i];
    if (hooksNode.name === 'DebugValue' && hooksNode.subHooks.length === 0) {
      hooksTree.splice(i, 1);
      i--;
      debugValueHooksNodes.push(hooksNode);
    } else {
      processDebugValues(hooksNode.subHooks, hooksNode);
    }
  }

  // Bubble debug value labels to their custom hook owner.
  // If there is no parent hook, just ignore them for now.
  // (We may warn about this in the future.)
  if (parentHooksNode !== null) {
    if (debugValueHooksNodes.length === 1) {
      parentHooksNode.value = debugValueHooksNodes[0].value;
    } else if (debugValueHooksNodes.length > 1) {
      parentHooksNode.value = debugValueHooksNodes.map(({value}) => value);
    }
  }
}

function handleRenderFunctionError(error: any): void {
  // original error might be any type.
  if (error === SuspenseException) {
    // An uncached Promise was used. We can't synchronously resolve the rest of
    // the Hooks but we can at least show what ever we got so far.
    return;
  }
  if (
    error instanceof Error &&
    error.name === 'ReactDebugToolsUnsupportedHookError'
  ) {
    throw error;
  }
  // If the error is not caused by an unsupported feature, it means
  // that the error is caused by user's code in renderFunction.
  // In this case, we should wrap the original error inside a custom error
  // so that devtools can give a clear message about it.
  // $FlowFixMe[extra-arg]: Flow doesn't know about 2nd argument of Error constructor
  const wrapperError = new Error('Error rendering inspected component', {
    cause: error,
  });
  // Note: This error name needs to stay in sync with react-devtools-shared
  // TODO: refactor this if we ever combine the devtools and debug tools packages
  wrapperError.name = 'ReactDebugToolsRenderError';
  // this stage-4 proposal is not supported by all environments yet.
  // $FlowFixMe[prop-missing] Flow doesn't have this type yet.
  wrapperError.cause = error;
  throw wrapperError;
}

export function inspectHooks<Props>(
  renderFunction: Props => React$Node,
  props: Props,
  currentDispatcher: ?CurrentDispatcherRef,
): HooksTree {
  // DevTools will pass the current renderer's injected dispatcher.
  // Other apps might compile debug hooks as part of their app though.
  if (currentDispatcher == null) {
    currentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
  }

  const previousDispatcher = currentDispatcher.current;
  currentDispatcher.current = DispatcherProxy;

  let readHookLog;
  let ancestorStackError;

  try {
    ancestorStackError = new Error();
    renderFunction(props);
  } catch (error) {
    handleRenderFunctionError(error);
  } finally {
    readHookLog = hookLog;
    hookLog = [];
    // $FlowFixMe[incompatible-use] found when upgrading Flow
    currentDispatcher.current = previousDispatcher;
  }
  const rootStack = ErrorStackParser.parse(ancestorStackError);
  return buildTree(rootStack, readHookLog);
}

function setupContexts(contextMap: Map<ReactContext<any>, any>, fiber: Fiber) {
  let current: null | Fiber = fiber;
  while (current) {
    if (current.tag === ContextProvider) {
      const context: ReactContext<any> = current.type;
      if (!contextMap.has(context)) {
        // Store the current value that we're going to restore later.
        contextMap.set(context, context._currentValue);
        // Set the inner most provider value on the context.
        context._currentValue = current.memoizedProps.value;
      }
    }
    current = current.return;
  }
}

function restoreContexts(contextMap: Map<ReactContext<any>, any>) {
  contextMap.forEach((value, context) => (context._currentValue = value));
}

function inspectHooksOfForwardRef<Props, Ref>(
  renderFunction: (Props, Ref) => React$Node,
  props: Props,
  ref: Ref,
  currentDispatcher: CurrentDispatcherRef,
): HooksTree {
  const previousDispatcher = currentDispatcher.current;
  let readHookLog;
  currentDispatcher.current = DispatcherProxy;
  let ancestorStackError;
  try {
    ancestorStackError = new Error();
    renderFunction(props, ref);
  } catch (error) {
    handleRenderFunctionError(error);
  } finally {
    readHookLog = hookLog;
    hookLog = [];
    currentDispatcher.current = previousDispatcher;
  }
  const rootStack = ErrorStackParser.parse(ancestorStackError);
  return buildTree(rootStack, readHookLog);
}

function resolveDefaultProps(Component: any, baseProps: any) {
  if (Component && Component.defaultProps) {
    // Resolve default props. Taken from ReactElement
    const props = assign({}, baseProps);
    const defaultProps = Component.defaultProps;
    for (const propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
    return props;
  }
  return baseProps;
}

export function inspectHooksOfFiber(
  fiber: Fiber,
  currentDispatcher: ?CurrentDispatcherRef,
): HooksTree {
  // DevTools will pass the current renderer's injected dispatcher.
  // Other apps might compile debug hooks as part of their app though.
  if (currentDispatcher == null) {
    currentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
  }

  if (
    fiber.tag !== FunctionComponent &&
    fiber.tag !== SimpleMemoComponent &&
    fiber.tag !== ForwardRef
  ) {
    throw new Error(
      'Unknown Fiber. Needs to be a function component to inspect hooks.',
    );
  }

  // Warm up the cache so that it doesn't consume the currentHook.
  getPrimitiveStackCache();

  // Set up the current hook so that we can step through and read the
  // current state from them.
  currentHook = (fiber.memoizedState: Hook);
  currentFiber = fiber;

  const type = fiber.type;
  let props = fiber.memoizedProps;
  if (type !== fiber.elementType) {
    props = resolveDefaultProps(type, props);
  }

  const contextMap = new Map<ReactContext<any>, any>();
  try {
    setupContexts(contextMap, fiber);

    if (fiber.tag === ForwardRef) {
      return inspectHooksOfForwardRef(
        type.render,
        props,
        fiber.ref,
        currentDispatcher,
      );
    }

    return inspectHooks(type, props, currentDispatcher);
  } finally {
    currentFiber = null;
    currentHook = null;

    restoreContexts(contextMap);
  }
}
