/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {createContext} from 'react';

// TODO: clean up and move to react/cache.

const CacheContext = createContext(null);

export const CacheProvider = CacheContext.Provider;

export function createCache() {
  return new Map();
}

export function readCache() {
  // TODO: this doesn't subscribe.
  // But we really want load context anyway.
  return CacheContext._currentValue;
}
