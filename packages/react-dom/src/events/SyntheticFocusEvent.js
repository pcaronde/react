/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import SyntheticUIEvent from './SyntheticUIEvent';
import {enablePluginEventSystem} from 'shared/ReactFeatureFlags';

let SyntheticFocusEvent;

if (enablePluginEventSystem) {
  /**
   * @interface FocusEvent
   * @see http://www.w3.org/TR/DOM-Level-3-Events/
   */
  SyntheticFocusEvent = SyntheticUIEvent.extend({
    relatedTarget: null,
  });
}

export default SyntheticFocusEvent;
