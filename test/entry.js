import '../src/index.js'
// The polyfill is dependent on the animationstart event for polyfilling animations declared in css.
// This causes timing issues when running some wpt tests that wait for animation.ready.
// The tests might run before the animations are polyfilled, making them flaky.

// The following code delays a selected list of tests until animations are polyfilled.

// List of names of tests that should wait for animationstart
const cssAnimationTests = [
  'View timeline attached to SVG graphics element'
]

const animationsStarted = new Promise((resolve) => {
  window.addEventListener('animationstart', () => {
    setTimeout(() => resolve(), 1);
  });
})

// Proxy the promise_test function
let nativePromiseTest;
Reflect.defineProperty(window, 'promise_test', {
  get() {
    return (func, name, properties) => {
      if (cssAnimationTests.includes(name)) {
        // Wait for animationstart before starting tests
        return nativePromiseTest.call(null, async (...args) => {
          await animationsStarted;
          return func.call(null, ...args);
        }, name, properties);
      } else {
        nativePromiseTest.call(null, func, name, properties);
      }
    };
  }, set(v) {
    nativePromiseTest = v;
  }
});