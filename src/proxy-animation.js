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
        // Apply pending playbackRate
        if (typeof details.pendingPlaybackRate == 'number') {
          const previousCurrentTime = details.animation.currentTime;
          details.animation.playbackRate = details.pendingPlaybackRate;
          const timelineTime = details.timeline.currentTime;
          details.startTime = details.pendingPlaybackRate ?
              timelineTime - previousCurrentTime / details.pendingPlaybackRate :
              previousCurrentTime;
          details.pendingPlaybackRate = null;
        }
        switch(details.playState) {
          case 'paused':
            details.startTime = null;
            break;

          case 'running':
          case 'finished':
            details.holdTime = null;
        }
        resolve();
      }
    });
  });
}

function getAnimationProperty(details, name) {
  if (details.timeline && (name in details))
    return details[name];
  else
    return details.animation[name];
}

function setAnimationProperty(details, name, value) {
  if (details.timeline && (name in details))
    details[name] = value;
  else
    details.animation[name] = value;
}

function effectivePlaybackRate(details) {
  if (details.pendingPlaybackRate)
    return details.pendingPlaybackRate;
  return details.animation.playbackRate;
}

function applyPendingPlaybackRate(details) {
  if (details.pendingPlaybackRate) {
    details.animation.playbackRate = details.pendingPlaybackRate;
    details.pendingPlaybackRate = null;
  }
}

function updateFinishedState(details) {
  if (!details.timeline)
    return;

  const isFinished = () => {
    if (details.playState == 'paused')
      return false;

    const playbackRate = effectivePlaybackRate(details);
    const currentTime = details.animation.currentTime;
    if (playbackRate < 0 && currentTime <= 0)
      return true;
    if (playbackRate > 0 &&
        currentTime >= details.animation.effect.getTiming().duration)
      return true;

    return false;
  };

  if (isFinished()) {
    if (details.playState != 'finished') {
      details.playState = 'finished';
      // TODO: Ensure that finished promise and events fire.
      // Possibly best to call finish after rAF though that would force a snap
      // to the boundary, which is not quite correct.
    }
  } else if (details.playState == 'finished') {
    details.playState = 'running';
    addAnimation(details.timeline, details.proxy);
  }
}

function hasActiveTimeline(details) {
  return !details.timeline || details.timeline.phase != 'inactive';
}

// Create an alternate Animation class which proxies API requests.
// TODO: Create a full-fledged proxy so missing methods are automatically
// fetched from Animation.
let proxyAnimations = new WeakMap();

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
      // Calls to reverse and updatePlaybackRate set a pending rate that does
      // not immediately take effect. The value of this property is
      // inaccessible via the web animations API and therefore explicitly
      // tracked.
      pendingPlaybackRate: null,
      proxy: this,
      sequence: 0, /* Used to track ready promises. */
      aborted: new Set(), /* Aborted sequences. */
    });
  }

  // -----------------------------------------
  // Helper method
  // -----------------------------------------

  tick(timelineTime) {
    if (timelineTime != null && this.playState == 'running') {
      proxyAnimations.get(this).animation.currentTime =
          (timelineTime - this.startTime) * this.playbackRate;
      updateFinishedState(proxyAnimations.get(this));
    }
  }

  // -----------------------------------------
  // Web animation API
  // -----------------------------------------

  get effect() {
    return proxyAnimations.get(this).animation.effect;
  }
  set effect(newEffect) {
    proxyAnimations.get(this).animation.effect = newEffect;
  }

  get timeline() {
    const details = proxyAnimations.get(this);
    return details.timeline || details.animation.timeline;
  }
  set timeline(newTimeline) {
    const oldTimeline = this.timeline;
    if (oldTimeline == newTimeline)
      return;

    const details = proxyAnimations.get(this);

    const fromScrollTimeline = (oldTimeline instanceof ScrollTimeline);
    const toScrollTimeline = (newTimeline instanceof ScrollTimeline);
    const previousCurrentTime = this.currentTime;
    const previousPlayState = this.playState;
    const playbackRate = effectivePlaybackRate(details);
    const pending = this.pending;

    if (fromScrollTimeline) {
      removeAnimation(details.timeline, details.animation);
    }

    details.resetCurrentTimeOnResume = false;
    if (toScrollTimeline) {
      // Cannot assume that the underlying native implementation supports
      // mutable timelines. Thus, we leave its timeline untouched, and simply
      // ensure that it is in the paused state.
      details.timeline = newTimeline;
      applyPendingPlaybackRate(details);
      details.animation.pause();
      switch(previousPlayState) {
        case 'idle':
          details.playState = 'idle';
          details.holdTime = null;
          details.startTime = null;
          break;

        case 'paused':
          details.playState = 'paused';
          details.resetCurrentTimeOnResume = true;
          details.animation.currentTime = previousCurrentTime;
          break;

        case 'running':
        case 'finished':
          details.playState = 'running';
          details.startTime =
              playbackRate < 0 ? details.animation.effect.getTiming().duration
                               : 0;
          details.holdTime = null;
          break;
      }
      addAnimation(details.timeline, this);
      if (pending)
        createReadyPromise(details);
    } else {
      // TODO: polyfill mutable timeline support. Cannot assume the native
      // animation supports mutable timelines. Could keep a list of detached
      // timelines and pump updates to current time via rAF.
      details.animation.timeline = newTimeline;
      if (fromScrollTimeline) {
        // TODO: sync pending status & play state (ready promise).
        details.timeline = null;
        details.animation.currentTime = previousCurrentTime;
      }
    }
  }

  get startTime() {
    return getAnimationProperty(proxyAnimations.get(this), 'startTime');
  }
  set startTime(value) {
    const previousCurrentTime = this.currentTime;
    const details = proxyAnimations.get(this);

    if (!details.timeline) {
      details.animation.startTime = value;
      return;
    }

    details.resetCurrentTimeOnResume = false;
    applyPendingPlaybackRate(details);
    details.readyPromise = null;
    if (typeof value == 'number') {
      details.holdTime = null;
      details.startTime = value;
      details.playState = 'running';
      const timelineTime = details.timeline.currentTime;
      details.animation.currentTime =
          (timelineTime - details.startTime) * this.playbackRate;
      updateFinishedState(details);
    } else {
      details.holdTime = previousCurrentTime;
      details.startTime = null;
      details.playState =
          (typeof previousCurrentTime == 'number') ? 'paused' : 'idle';
    }
  }

  get currentTime() {
    const details = proxyAnimations.get(this);
    if (details.timeline) {
      if (!details.playState || details.playState == 'idle')
        return null;
      if (details.playState == 'running' &&
          details.timeline.phase == 'inactive')
        return null;
    }
    return details.animation.currentTime;
  }
  set currentTime(value) {
    const details = proxyAnimations.get(this);
    details.animation.currentTime = value;
    details.resetCurrentTimeOnResume = false;
    if (details.timeline) {
       // Update the start or the hold time of the proxy animation depending
       // on the play sate.
       const timelineTime = details.timeline.currentTime;
       const playbackRate = this.playbackRate;
       switch(details.playState) {
        case 'running':
        case 'finished':
          // TODO: handle value == null or playbackRate == 0.
          details.startTime = timelineTime - value / playbackRate;
          details.holdTime = null;
          break;

        default:
           details.playState = value ? 'paused' : 'idle';
           details.holdTime = value;
           details.startTime = null;
           break;
       }
       updateFinishedState(details);
    }
  }

  get playbackRate() {
    return proxyAnimations.get(this).animation.playbackRate;
  }
  set playbackRate(value) {
    const details = proxyAnimations.get(this);
    details.animation.playbackRate = value;
    details.pendingPlaybackRate = null;
    if (details.timeline)
      updateFinishedState(details);
  }

  get playState() {
    return getAnimationProperty(proxyAnimations.get(this), 'playState');
  }

  get replaceState() {
    // TODO: Fix me. Replace state is not a boolean.
    return proxyAnimations.get(this).animation.pending;
  }

  get pending() {
    const details = proxyAnimations.get(this);
    if (details.timeline)
      return !!details.readyPromise;

    return details.animation.pending;
  }

  finish() {
    const details = proxyAnimations.get(this);
    if (!details.timeline) {
      details.animation.finish();
      return;
    }

    const playbackRate = effectivePlaybackRate(details);
    const duration = details.animation.effect.getTiming().duration;
    if (playbackRate == 0 || (playbackRate < 0 && duration == Infinity)) {
      // Let native implementation handle throwing the exception. This should
      // not affect the state of the native animation.
      details.animation.finish();
      return;
    }

    applyPendingPlaybackRate(details);
    const seekTime = playbackRate < 0 ? 0 : duration;
    const timelineTime = details.timeline.currentTime;
    details.animation.currentTime = seekTime;

    if (hasActiveTimeline(details)) {
      details.startTime = timelineTime - seekTime / playbackRate;
      details.holdTime = null;
      details.playState = 'finished';
      removeAnimation(details.timeline, details.animation);
      details.readyPromise = null;
      // Resolve the finished promise and fire the finished event.
      details.animation.finish();
    } else {
      details.startTime = null;
      details.holdTime = seekTime;
      details.playState = 'paused';
    }
  }

  play() {
    const details = proxyAnimations.get(this);
    if (!details.timeline) {
      details.animation.play();
      return;
    }

    let previousCurrentTime = details.animation.currentTime;

    // Resume of a paused animation after a timeline change snaps to
    // the scroll position.
    if (details.resetCurrentTimeOnResume) {
      previousCurrentTime = null;
      details.resetCurrentTimeOnResume = false;
    }

    // Snap to boundary if currently out of bounds.
    const playbackRate = effectivePlaybackRate(details);
    const duration = details.animation.effect.getTiming().duration;
    let seekTime = null;
    if (playbackRate > 0 && (previousCurrentTime == null ||
                             previousCurrentTime < 0 ||
                             previousCurrentTime >= duration)) {
      // TODO: throw exception if duration == Infinity.
      seekTime = 0;
    } else if (playbackRate < 0 && (previousCurrentTime == null ||
                                    previousCurrentTime <= 0 ||
                                    previousCurrentTime > duration)) {
      seekTime = duration;
    } else if (playbackRate == 0 && previousCurrentTime == null) {
      seekTime = 0;
    }

    details.playState = "running";
    if (seekTime != null) {
      this.startTime = seekTime;
    } else {
      // Force recalculation of the start time.
      this.currentTime = previousCurrentTime;
    }

    addAnimation(details.timeline, this);
    if (!details.readyPromise)
      createReadyPromise(details);
  }

  pause() {
    const details = proxyAnimations.get(this);
    details.animation.pause();
    if (!details.timeline)
      return;

    if (details.playState == "paused")
      return;

    const previousCurrentTime = details.animation.currentTime;
    if (!previousCurrentTime) {
      details.startTime =
          effectivePlaybackRate(details) < 0 ?
              details.animation.effect.getTiming().duration : 0;
    } else {
       details.holdTime = previousCurrentTime;
    }
    details.playState = "paused";
    removeAnimation(details.timeline, details.animation);
    if (!details.readyPromise)
      createReadyPromise(details);
  }

  reverse() {
    const details = proxyAnimations.get(this);
    if (!details.timeline) {
      details.animation.reverse();
      return;
    }

    const playbackRate = effectivePlaybackRate(details);
    const duration = details.animation.effect.getTiming().duration;
    if (playbackRate == 0 || (playbackRate > 0 && duration == Infinity)) {
      // Let native implementation handle throwing the exception.
      details.animation.reverse();
      return;
    }

    this.updatePlaybackRate(-playbackRate);
    this.play();
  }

  updatePlaybackRate(rate) {
    const details = proxyAnimations.get(this);
    details.pendingPlaybackRate = rate;
    if (!details.timeline) {
      details.animation.updatePlaybackRate(rate);
      return;
    }

    const previousCurrentTime = this.currentTime;

    // We do not update the playback rate of the underlaying animation since
    // timing of when the playback rate takes effect depends on the play state.
    switch(details.playState) {
      case 'idle':
      case 'paused':
        applyPendingPlaybackRate(details);
        break;

      case 'finished':
      case 'running':
        // pending playback rate is applied when the pending ready promise is
        // resolved.
        createReadyPromise(details);
        updateFinishedState(details);
    }
  }

  persist() {
    proxyAnimations.get(this).animation.persist();
  }

  get id() {
    return proxyAnimations.get(this).animation.id;
  }

  cancel() {
    const details = proxyAnimations.get(this);
    details.animation.cancel();
    if (details.timeline) {
      details.startTime = null;
      details.holdTime = null;
      details.playState = 'idle';
      removeAnimation(details.timeline, details.animation);
      if (details.readyPromise) {
        details.aborted.add(details.sequence);
        details.readyPromise = null;
      }
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
    if (details.timeline) {
      if (details.readyPromise)
        return details.readyPromise;

      // TODO: If not waiting on a pending task, we still need to return a ready
      // promise; however, the promise can be immediately resolved. Cannot use
      // the underlying animation as it is intentionally locked in a
      // pause-pending state.
    }

    return details.animation.ready;
  }

};

export function animate(keyframes, options) {
  let timeline = options.timeline;
  if (!timeline || !(timeline instanceof ScrollTimeline)) {
    let animation = nativeElementAnimate.apply(this, [keyframes, options]);
    // Even through this animation runs as a native animation, we still wrap
    // it in a proxy animation to allow changing of the animation's timeline.
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


