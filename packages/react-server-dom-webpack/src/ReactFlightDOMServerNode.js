/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {ReactModel} from 'react-server/src/ReactFlightServer';
import type {BundlerConfig} from './ReactFlightServerWebpackBundlerConfig';
import type {Writable} from 'stream';

import {
  createRequest,
  startWork,
  startFlowing,
} from 'react-server/src/ReactFlightServer';

function createDrainHandler(destination, request) {
  return () => startFlowing(request, destination);
}

type Options = {
  onError?: (error: mixed) => void,
};

type Controls = {|
  startWriting(destination: Writable): void,
|};

function renderToNodePipe(
  model: ReactModel,
  webpackMap: BundlerConfig,
  options?: Options,
): Controls {
  const request = createRequest(
    model,
    webpackMap,
    options ? options.onError : undefined,
  );
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
  };
}

export {renderToNodePipe};
