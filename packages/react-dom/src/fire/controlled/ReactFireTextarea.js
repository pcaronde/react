/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import invariant from 'shared/invariant';
import warning from 'shared/warning';
import {getCurrentFiberOwnerNameInDevOrNull} from 'react-reconciler/src/ReactCurrentFiber';

import {controlledValuePropTypes} from './ReactFirePropTypes';
import {getToStringValue, toString} from '../ReactFireUtils';
import type {ToStringValue} from '../ReactFireUtils';

let didWarnValDefaultVal = false;

type TextAreaWithWrapperState = HTMLTextAreaElement & {
  _wrapperState: {
    initialValue: ToStringValue,
  },
};

export function getHostComponentTextareaProps(element: Element, props: Object) {
  const node = ((element: any): TextAreaWithWrapperState);
  invariant(
    props.dangerouslySetInnerHTML == null,
    '`dangerouslySetInnerHTML` does not make sense on <textarea>.',
  );

  // Always set children to the same thing. In IE9, the selection range will
  // get reset if `textContent` is mutated.  We could add a check in setTextContent
  // to only set the value if/when the value differs from the node value (which would
  // completely solve this IE9 bug), but Sebastian+Sophie seemed to like this
  // solution. The value can be a boolean or object so that's why it's forced
  // to be a string.
  const hostProps = {
    ...props,
    value: undefined,
    defaultValue: undefined,
    children: toString(node._wrapperState.initialValue),
  };

  return hostProps;
}

export function initHostComponentTextareaWrapperState(
  element: Element,
  props: Object,
) {
  const node = ((element: any): TextAreaWithWrapperState);
  if (__DEV__) {
    controlledValuePropTypes.checkPropTypes('textarea', props);
    if (
      props.value !== undefined &&
      props.defaultValue !== undefined &&
      !didWarnValDefaultVal
    ) {
      warning(
        false,
        '%s contains a textarea with both value and defaultValue props. ' +
          'Textarea elements must be either controlled or uncontrolled ' +
          '(specify either the value prop, or the defaultValue prop, but not ' +
          'both). Decide between using a controlled or uncontrolled textarea ' +
          'and remove one of these props. More info: ' +
          'https://fb.me/react-controlled-components',
        getCurrentFiberOwnerNameInDevOrNull() || 'A component',
      );
      didWarnValDefaultVal = true;
    }
  }

  let initialValue = props.value;

  // Only bother fetching default value if we're going to use it
  if (initialValue == null) {
    let defaultValue = props.defaultValue;
    // TODO (yungsters): Remove support for children content in <textarea>.
    let children = props.children;
    if (children != null) {
      if (__DEV__) {
        warning(
          false,
          'Use the `defaultValue` or `value` props instead of setting ' +
            'children on <textarea>.',
        );
      }
      invariant(
        defaultValue == null,
        'If you supply `defaultValue` on a <textarea>, do not pass children.',
      );
      if (Array.isArray(children)) {
        invariant(
          children.length <= 1,
          '<textarea> can only have at most one child.',
        );
        children = children[0];
      }

      defaultValue = children;
    }
    if (defaultValue == null) {
      defaultValue = '';
    }
    initialValue = defaultValue;
  }

  node._wrapperState = {
    initialValue: getToStringValue(initialValue),
  };
}

export function applyHostComponentTextareaMountWrapper(
  element: Element,
  props: Object,
) {
  const node = ((element: any): TextAreaWithWrapperState);
  // This is in postMount because we need access to the DOM node, which is not
  // available until after the component has mounted.
  const textContent = node.textContent;

  // Only set node.value if textContent is equal to the expected
  // initial value. In IE10/IE11 there is a bug where the placeholder attribute
  // will populate textContent as well.
  // https://developer.microsoft.com/microsoft-edge/platform/issues/101525/
  if (textContent === node._wrapperState.initialValue) {
    node.value = textContent;
  }
}

export function restoreHostComponentTextareaControlledState(
  element: Element,
  props: Object,
) {
  // DOM component is still mounted; update
  updateWrapper(element, props);
}

export function updateWrapper(element: Element, props: Object) {
  const node = ((element: any): TextAreaWithWrapperState);
  const value = getToStringValue(props.value);
  const defaultValue = getToStringValue(props.defaultValue);
  if (value != null) {
    // Cast `value` to a string to ensure the value is set correctly. While
    // browsers typically do this as necessary, jsdom doesn't.
    const newValue = toString(value);
    // To avoid side effects (such as losing text selection), only set value if changed
    if (newValue !== node.value) {
      node.value = newValue;
    }
    if (props.defaultValue == null && node.defaultValue !== newValue) {
      node.defaultValue = newValue;
    }
  }
  if (defaultValue != null) {
    node.defaultValue = toString(defaultValue);
  }
}
