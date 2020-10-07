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
      });
      return;
    }
    const isScrollAnimation = timeline && timeline instanceof ScrollTimeline;
    const animationTimeline = isScrollAnimation ? undefined : timeline;
    proxyAnimations.set(this, {
      animation: new nativeAnimation(effect, animationTimeline),
      timeline: isScrollAnimation ? timeline : undefined,
      playState: isScrollAnimation ? "idle" : null,
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
    return proxyAnimations.get(this).animation.pending;
  }

  finish() {
    proxyAnimations.get(this).animation.finish();
    let internalTimeline = proxyAnimations.get(this).timeline;
    if (!internalTimeline) {
      proxyAnimations.get(this).animation.play();
      return;
    }
    if (proxyAnimations.get(this).playState == "finished")
      return;
    proxyAnimations.get(this).playState = "finished";
    removeAnimation(internalTimeline, proxyAnimations.get(this).animation);
  }

  play() {
    let internalTimeline = proxyAnimations.get(this).timeline;
    if (!internalTimeline) {
      proxyAnimations.get(this).animation.play();
      return;
    }
    if (proxyAnimations.get(this).animation.playState != "paused") {
      proxyAnimations.get(this).animation.play();
      proxyAnimations.get(this).animation.pause();
    }
    if (proxyAnimations.get(this).playState == "running")
      return;
    addAnimation(internalTimeline, proxyAnimations.get(this).animation);
    proxyAnimations.get(this).playState = "running";
  }

  pause() {
    let internalTimeline = proxyAnimations.get(this).timeline;
    if (!internalTimeline) {
      proxyAnimations.get(this).animation.pause();
      return;
    }
    if (proxyAnimations.get(this).playState == "paused")
      return;
    proxyAnimations.get(this).playState = "paused";
    removeAnimation(internalTimeline, proxyAnimations.get(this).animation);
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
    proxyAnimations.get(this).animation.cancel();
    let internalTimeline = proxyAnimations.get(this).timeline;
    if (!internalTimeline)
      return;
    if (proxyAnimations.get(this).playState == "idle" ||
        proxyAnimations.get(this).playState == "finished")
      return;
    if (proxyAnimations.get(this).playState == "running")
      removeAnimation(internalTimeline, proxyAnimations.get(this).animation);
    proxyAnimations.get(this).playState = "finished";
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


