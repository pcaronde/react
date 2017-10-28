/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

describe('ReactDOMComponentTree', () => {
  let React;
  let ReactDOM;
  let AnotherReactDOM;
  let ReactDOMServer;

  function renderMarkupIntoDocument(elt) {
    const container = document.createElement('div');
    // Force server-rendering path:
    container.innerHTML = ReactDOMServer.renderToString(elt);
    return ReactDOM.hydrate(elt, container);
  }

  function getTypeOf(instance) {
    return instance.type;
  }

  function simulateInput(elem, value) {
    const inputEvent = new Event('input', {
      bubbles: true,
    });
    setUntrackedInputValue.call(elem, value);
    elem.dispatchEvent(inputEvent);
  }

  function simulateClick(elem) {
    const event = new MouseEvent('click', {
      bubbles: true,
    });
    elem.dispatchEvent(event);
  }

  const setUntrackedInputValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  ).set;

  beforeEach(() => {
    React = require('react');
    ReactDOM = require('react-dom');
    ReactDOMServer = require('react-dom/server');
    document.innerHTML = '';
  });

  it('finds nodes for instances', () => {
    // This is a little hard to test directly. But refs rely on it -- so we
    // check that we can find a ref at arbitrary points in the tree, even if
    // other nodes don't have a ref.
    class Component extends React.Component {
      render() {
        var toRef = this.props.toRef;
        return (
          <div ref={toRef === 'div' ? 'target' : null}>
            <h1 ref={toRef === 'h1' ? 'target' : null}>hello</h1>
            <p ref={toRef === 'p' ? 'target' : null}>
              <input ref={toRef === 'input' ? 'target' : null} />
            </p>
            goodbye.
          </div>
        );
      }
    }

    function renderAndGetRef(toRef) {
      const inst = renderMarkupIntoDocument(<Component toRef={toRef} />);
      return inst.refs.target.nodeName;
    }

    expect(renderAndGetRef('div')).toBe('DIV');
    expect(renderAndGetRef('h1')).toBe('H1');
    expect(renderAndGetRef('p')).toBe('P');
    expect(renderAndGetRef('input')).toBe('INPUT');
  });

  it('finds closest instance for node when an event happens', done => {
    const elemID = 'aID';
    const innerHTML = {__html: `<div id="${elemID}"></div>`};

    class ClosestInstance extends React.Component {
      id = 'closestInstance';
      _onClick = e => {
        const node = e.currentTarget;
        expect(node.id).toBe(this.id);
        done();
      };
      render() {
        return (
          <div
            id="closestInstance"
            onClick={this._onClick}
            dangerouslySetInnerHTML={innerHTML}
          />
        );
      }
    }

    const component = <ClosestInstance />;
    const container = document.createElement('div');
    ReactDOM.render(<section>{component}</section>, container);
    document.body.appendChild(container);
    simulateClick(document.getElementById(elemID));
  });

  it('finds instances for nodes when events happen', done => {
    const inputID = 'inputID';
    const startValue = 'start';
    const finishValue = 'finish';

    class Controlled extends React.Component {
      state = {value: startValue};
      a = null;
      _onChange = e => {
        const node = e.currentTarget;
        expect(node.value).toEqual(finishValue);
        expect(node.id).toBe(inputID);
        done();
      };
      render() {
        return (
          <div>
            <input
              id={inputID}
              type="text"
              ref={n => (this.a = n)}
              value={this.state.value}
              onChange={this._onChange}
            />
          </div>
        );
      }
    }

    const component = <Controlled />;
    const container = document.createElement('div');
    const instance = ReactDOM.render(component, container);
    document.body.appendChild(container);
    simulateInput(instance.a, finishValue);
  });

  it('finds instance of node being unmounted', () => {
    spyOn(console, 'error');
    const component = <div></div>;
    const container = document.createElement('div');
    const instance = ReactDOM.render(component, container);
    ReactDOM.unmountComponentAtNode(container);
    expectDev(console.error.calls.count()).toBe(0);
  });

  it('finds instance from node to stop rendering over other react rendered components', () => {
    spyOn(console, 'error');
    const component = <div><span>Hello</span></div>;
    const anotherComponent = <div></div>;
    const container = document.createElement('div');
    const instance = ReactDOM.render(component, container);
    ReactDOM.render(anotherComponent, instance);
    expectDev(console.error.calls.count()).toBe(1);
    expectDev(console.error.calls.argsFor(0)[0]).toContain(
      'render(...): Replacing React-rendered children with a new root ' +
      'component. If you intended to update the children of this node, ' +
      'you should instead have the existing children update their state ' +
      'and render the new components instead of calling ReactDOM.render.'
    );
  });
});
