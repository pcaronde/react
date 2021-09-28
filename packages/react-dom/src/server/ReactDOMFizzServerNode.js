/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {ReactNodeList} from 'shared/ReactTypes';
import type {Writable} from 'stream';

import ReactVersion from 'shared/ReactVersion';

import {
  createRequest,
  startWork,
  startFlowing,
  abort,
} from 'react-server/src/ReactFizzServer';

import {
  createResponseState,
  createRootFormatContext,
} from './ReactDOMServerFormatConfig';

function createDrainHandler(destination, request) {
  return () => startFlowing(request, destination);
}

type Options = {|
  identifierPrefix?: string,
  namespaceURI?: string,
  progressiveChunkSize?: number,
  onCompleteShell?: () => void,
  onCompleteAll?: () => void,
  onError?: (error: mixed) => void,
|};

type Controls = {|
  // Cancel any pending I/O and put anything remaining into
  // client rendered mode.
  abort(): void,
  startWriting(destination: Writable): void,
|};

function createRequestImpl(children: ReactNodeList, options: void | Options) {
  return createRequest(
    children,
    createResponseState(options ? options.identifierPrefix : undefined),
    createRootFormatContext(options ? options.namespaceURI : undefined),
    options ? options.progressiveChunkSize : undefined,
    options ? options.onError : undefined,
    options ? options.onCompleteAll : undefined,
    options ? options.onCompleteShell : undefined,
  );
}

function renderToNodePipe(
  children: ReactNodeList,
  options?: Options,
): Controls {
  const request = createRequestImpl(children, options);
  let hasStartedFlowing = false;
  startWork(request);
  return {
    startWriting(destination) {
      if (hasStartedFlowing) {
        return;
      }
      hasStartedFlowing = true;
      startFlowing(request, destination);
      destination.on('drain', createDrainHandler(destination, request));
    },
    abort() {
      abort(request);
    },
  };
}

export {renderToNodePipe, ReactVersion as version};
