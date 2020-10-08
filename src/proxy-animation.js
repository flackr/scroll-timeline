import {
  ScrollTimeline,
  installScrollOffsetExtension,
  addAnimation,
  removeAnimation
} from "./scroll-timeline-base";

const nativeElementAnimate = window.Element.prototype.animate;
const nativeAnimation = window.Animation;

/**
 * Decides whether to use native Element.prototype.animate function in regular fashion or pass it to our polyfill
 *  so its current time is driven by scroll event
 * @param keyframes {Object} array of keyframe objects
 * @param options {Object} WAAPI options object
 * @returns {Function}
 */

function createReadyPromise(details) {
  let sequence = ++details.sequence;
  let promise = details.readyPromise = new Promise((resolve, reject) => {
    // TODO: We should actually not apply the animation until this is
    // resolved.
    requestAnimationFrame(() => {
      // If this promise was replaced, this animation was aborted.
      if (details.readyPromise == promise)
        details.readyPromise = null;
      if (details.aborted.has(sequence)) {
        details.aborted.delete(sequence);
        // Reject with a non-visible AbortError.
        reject(new DOMException("Animation aborted", "AbortError"));
      } else {
        resolve();
      }
    });
  });
}

// Create an alternate Animation class which proxies API requests.
// TODO: Create a full-fledged proxy so missing methods are automatically
// fetched from Animation.
let proxyAnimations = new WeakMap();
export class ProxyAnimation {
  constructor(effect, timeline) {
    if (effect instanceof nativeAnimation) {
      proxyAnimations.set(this, {
        animation: effect,
        timeline,
        playState: "idle",
        readyPromise: null,
        sequence: 0, /* Used to track ready promises. */
        aborted: new Set(), /* Aborted sequences. */
      });
      return;
    }
    const isScrollAnimation = timeline && timeline instanceof ScrollTimeline;
    const animationTimeline = isScrollAnimation ? undefined : timeline;
    proxyAnimations.set(this, {
      animation: new nativeAnimation(effect, animationTimeline),
      timeline: isScrollAnimation ? timeline : undefined,
      playState: isScrollAnimation ? "idle" : null,
      readyPromise: null,
      sequence: 0, /* Used to track ready promises. */
      aborted: new Set(), /* Aborted sequences. */
    });
  }

  get effect() {
    return proxyAnimations.get(this).animation.effect;
  }
  set effect(newEffect) {
    return proxyAnimations.get(this).animation.effect = newEffect;
  }

  get timeline() {
    const internalTimeline = proxyAnimations.get(this).timeline;
    if (internalTimeline !== undefined)
      return internalTimeline;
    return proxyAnimations.get(this).animation.timeline;
  }

  get startTime() {
    const internalPlayState = proxyAnimations.get(this).playState;
    if (!internalPlayState)
      return proxyAnimations.get(this).animation.startTime;
    if (internalPlayState == "running")
      return 0;
    return null;
  }
  set startTime(value) {
    proxyAnimations.get(this).animation.startTime = value;
  }

  get currentTime() {
    return proxyAnimations.get(this).animation.currentTime;
  }
  set currentTime(value) {
    proxyAnimations.get(this).animation.currentTime = value;
  }

  get playbackRate() {
    return proxyAnimations.get(this).animation.playbackRate;
  }
  set playbackRate(value) {
    proxyAnimations.get(this).animation.playbackRate = value;
  }

  get playState() {
    const internalPlayState = proxyAnimations.get(this).playState;
    if (internalPlayState)
      return internalPlayState;
    return proxyAnimations.get(this).animation.playState;
  }

  get replaceState() {
    return proxyAnimations.get(this).animation.pending;
  }

  get pending() {
    const details = proxyAnimations.get(this);
    if (details.readyPromise)
      return true;
    return proxyAnimations.get(this).animation.pending;
  }

  finish() {
    let details = proxyAnimations.get(this);
    details.animation.finish();
    let internalTimeline = details.timeline;
    if (!internalTimeline) {
      details.animation.play();
      return;
    }
    if (details.playState == "finished")
      return;
    details.playState = "finished";
    details.readyPromise = null;
    removeAnimation(internalTimeline, details.animation);
  }

  play() {
    let details = proxyAnimations.get(this);
    if (!details.timeline) {
      proxyAnimations.get(this).animation.play();
      return;
    }
    if (proxyAnimations.get(this).animation.playState != "paused") {
      proxyAnimations.get(this).animation.play();
      proxyAnimations.get(this).animation.pause();
    }
    if (proxyAnimations.get(this).playState == "running")
      return;

    addAnimation(details.timeline, proxyAnimations.get(this).animation);
    proxyAnimations.get(this).playState = "running";
    createReadyPromise(details);
  }

  pause() {
    let details = proxyAnimations.get(this);
    if (!details.timeline) {
      proxyAnimations.get(this).animation.pause();
      return;
    }
    if (proxyAnimations.get(this).playState == "paused")
      return;
    proxyAnimations.get(this).playState = "paused";
    removeAnimation(details.timeline, details.animation);
    createReadyPromise(details);
  }

  reverse() {
    proxyAnimations.get(this).animation.reverse();
  }

  updatePlaybackRate(rate) {
    proxyAnimations.get(this).animation.updatePlaybackRate(rate);
  }

  persist() {
    proxyAnimations.get(this).animation.persist();
  }

  get id() {
    return proxyAnimations.get(this).animation.id;
  }

  cancel() {
    let details = proxyAnimations.get(this);
    details.animation.cancel();
    let internalTimeline = details.timeline;
    if (!internalTimeline)
      return;
    if (details.playState == "idle" ||
        details.playState == "finished")
      return;
    if (details.playState == "running")
      removeAnimation(internalTimeline, details.animation);
    details.playState = "finished";
    if (details.readyPromise) {
      details.aborted.add(details.sequence);
      details.readyPromise = null;
    }
  }

  get onfinish() {
    return proxyAnimations.get(this).animation.onfinish;
  }
  set onfinish(value) {
    proxyAnimations.get(this).animation.onfinish = value;
  }
  get oncancel() {
    return proxyAnimations.get(this).animation.oncancel;
  }
  set oncancel(value) {
    proxyAnimations.get(this).animation.oncancel = value;
  }
  get onremove() {
    return proxyAnimations.get(this).animation.onremove;
  }
  set onremove(value) {
    proxyAnimations.get(this).animation.onremove = value;
  }

  get finished() {
    proxyAnimations.get(this).animation.finished;
  }

  get ready() {
    const details = proxyAnimations.get(this);
    if (details.readyPromise)
      return details.readyPromise;

    proxyAnimations.get(this).animation.ready;
  }

};

export function animate(keyframes, options) {
  let timeline = options.timeline;
  if (!timeline || !(timeline instanceof ScrollTimeline)) {
    return nativeElementAnimate.apply(this, [keyframes, options]);
  }
  delete options.timeline;
  let animation = nativeElementAnimate.apply(this, [keyframes, options]);
  // TODO: Create a proxy for the animation to control and fake the animation
  // play state.
  animation.pause();
  let proxyAnimation = new ProxyAnimation(animation, timeline);
  proxyAnimation.play();
  return proxyAnimation;
};


