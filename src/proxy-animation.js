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

// Hack for testing
window.proxyAnimations = proxyAnimations;

export class ProxyAnimation {
  constructor(effect, timeline) {
    const animation =
        (effect instanceof nativeAnimation) ?
           effect : new nativeAnimation(effect, animationTimeline);
    const isScrollAnimation = timeline instanceof ScrollTimeline;
    const animationTimeline = isScrollAnimation ? undefined : timeline;
    proxyAnimations.set(this, {
      animation: animation,
      timeline: isScrollAnimation ? timeline : undefined,
      playState: isScrollAnimation ? "idle" : null,
      readyPromise: null,
      // Start and hold times are directly tracked in the proxy despite being
      // accessible via the animation so that direct manipulation of these
      // properties does not affect the play state of the underlying animation.
      // Note that any changes to these values require an update of current
      // time for the underlying animation to ensure that its hold time is set
      // to the correct position.
      startTime: null,
      holdTime: null,
      // When changing the timeline on a paused animation, we defer updating the
      // start time until the animation resumes playing.
      resetCurrentTimeOnResume: false,
      // Calls to reverse and updatePlaybackRate set a pending rate that
      // does not immediately take effect. The value of this property is
      // inaccessible via the web animations API.
      pendingPlaybackRate: null,
      sequence: 0, /* Used to track ready promises. */
      aborted: new Set(), /* Aborted sequences. */
    });
  }

  getProperty(name) {
    const proxy = proxyAnimations.get(this);
    if (proxy.timeline && (name in proxy))
      return proxy[name];
    else
      return proxy.animation[name];
  }

  setProperty(name, value) {
    const proxy = proxyAnimations.get(this);
    if (proxy.timeline && (name in proxy))
      proxy[name] = value;
    else
      proxy.animation[name] = value;
  }

  useProxy() {
    return !!proxyAnimations.get(this).timeline;
  }

  effectivePlaybackRate() {
    const proxy = proxyAnimations.get(this);
    if (proxy.pendingPlaybackRate)
      return proxy.pendingPlaybackRate;
    return this.playbackRate;
  }

  commitPendingPlaybackRate() {
    const proxy = proxyAnimations.get(this);
    if (proxy.pendingPlaybackRate) {
      this.playbackRate = proxy.pendingPlaybackRate;
      proxy.pendingPlaybackRate = null;
    }
  }

  get effect() {
    return this.getProperty('effect');
  }
  set effect(newEffect) {
    this.setProperty('effect', newEffect);
  }

  get timeline() {
    return this.getProperty('timeline');
  }
  set timeline(newTimeline) {
    const oldTimeline = this.timeline;
    if (oldTimeline == newTimeline)
      return;

    const fromScrollTimeline = (oldTimeline instanceof ScrollTimeline);
    const toScrollTimeline = (newTimeline instanceof ScrollTimeline);
    const previousCurrentTime = this.currentTime;
    const previousPlayState = this.playState;
    const playbackRate = this.effectivePlaybackRate();
    const pending = this.pending;
    const proxy = proxyAnimations.get(this);

    if (fromScrollTimeline) {
      removeAnimation(proxy.timeline, proxy.animation);
    }

    proxy.resetCurrentTimeOnResume = false;
    if (toScrollTimeline) {
      // Cannot assume that the underlying native implementation supports
      // mutable timelines. Thus, we leave its timeline untouched, and simply
      // ensure that it is in the paused state.
      proxy.timeline = newTimeline;
      this.commitPendingPlaybackRate();
      proxy.animation.pause();
      switch(previousPlayState) {
        case 'idle':
          proxy.playState = 'idle';
          proxy.holdTime = null;
          proxy.startTime = null;
          break;

        case 'paused':
          proxy.playState = 'paused';
          proxy.resetCurrentTimeOnResume = true;
          this.currentTime = previousCurrentTime;
          break;

        case 'running':
        case 'finished':
          proxy.playState = 'running';
          this.startTime =
              playbackRate < 0 ? proxy.animation.effect.getTiming().duration
                               : 0;
          break;
      }
      addAnimation(proxy.timeline, this);
      if (pending)
        createReadyPromise(proxy);
    } else {
      // TODO: polyfill mutable timeline support. Cannot assume the native
      // animation supports mutable timelines. Could keep a list of detached
      // timelines and pump updates to current time via rAF.
      proxy.animation.timeline = newTimeline;
      if (fromScrollTimeline) {
        // TODO: sync pending status & play state (ready promise).
        proxyAnimations.get(this).currentTime = previousCurrentTime;
      }
    }
  }

  get startTime() {
    return this.getProperty('startTime');
  }
  set startTime(value) {
    this.setProperty('startTime', value);
    const proxy = proxyAnimations.get(this);
    proxy.resetCurrentTimeOnResume = false;
    if (this.useProxy()) {
      proxy.playState = 'running';
    }
  }

  get currentTime() {
    return this.getProperty('currentTime');
  }
  set currentTime(value) {
    this.setProperty('currentTime', value);
    const proxy = proxyAnimations.get(this);
    // proxy.resetCurrentTimeOnResume = false;
    if (this.useProxy()) {
       // Update the start or the hold time of the proxy animation depending
       // on the play sate.
       const timelineTime = proxy.timeline.currentTime;
       const playbackRate = this.playbackRate;
       switch(proxy.playState) {
         case 'paused':
           proxy.holdTime = value;
           proxy.startTime = null;
           break;

        case 'running':
        case 'finished':
          // TODO: handle value == null or playbackRate == 0.
          proxy.startTime = timelineTime - value / playbackRate;
          proxy.holdTime = null;
          break;

        default:
          // TODO: implement me.
       }
    }
  }

  get playbackRate() {
    return this.getProperty('playbackRate');
  }
  set playbackRate(value) {
    this.setProperty('playbackRate', value);
  }

  get playState() {
    return this.getProperty('playState');
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
    let proxy = proxyAnimations.get(this);
    if (!this.useProxy()) {
      proxy.animation.play();
      return;
    }

    let previousCurrentTime = this.currentTime;
    proxy.animation.pause();
    if (!previousCurrentTime || proxy.resetCurrentTimeOnResume) {
      this.startTime =
          this.effectivePlaybackRate() < 0 ?
              proxy.animation.effect.getTiming().duration : 0;
      proxy.resetCurrentTimeOnResume = false;
    }

    proxy.playState = "running";
    addAnimation(proxy.timeline, this);

    if (!proxy.readyPromise)
      createReadyPromise(proxy);
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
    const proxy = proxyAnimations.get(this);
    const playbackRate = this.effectivePlaybackRate();
    proxy.animation.reverse();
    proxy.pendingPlaybackRate = -playbackRate;
  }

  updatePlaybackRate(rate) {
    const proxy = proxyAnimations.get(this);
    proxy.animation.updatePlaybackRate(rate);
    proxy.pendingPlaybackRate = rate;
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
    const proxy = proxyAnimations.get(this);
    if (this.useProxy()) {
      if (proxy.readyPromise)
        return proxy.readyPromise;
    }
    return proxy.animation.ready;
  }

};

export function animate(keyframes, options) {
  let timeline = options.timeline;
  if (!timeline || !(timeline instanceof ScrollTimeline)) {
    let animation = nativeElementAnimate.apply(this, [keyframes, options]);
    // Even through this animation runs as a native animation, we still wrap
    // it in a proxy animation to handle changing the animation's timeline.
    let proxyAnimation = new ProxyAnimation(animation, timeline);
    return proxyAnimation;
  }
  delete options.timeline;
  let animation = nativeElementAnimate.apply(this, [keyframes, options]);
  animation.pause();
  let proxyAnimation = new ProxyAnimation(animation, timeline);
  proxyAnimation.play();
  return proxyAnimation;
};


