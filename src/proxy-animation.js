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
        return;
      }

      // See pending play and pause tasks in:
      // https://www.w3.org/TR/web-animations-1/#playing-an-animation-section
      // https://www.w3.org/TR/web-animations-1/#pausing-an-animation-section

      // TODO: Consider implementing commitPendingPlay and commitPendingPause
      // functions with closer adherence to the spec.

      // Apply pending playbackRate
      if (details.pendingPlaybackRate !== null) {
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
    });
  });
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

  // No change in play state if idle or paused.
  if (details.playState != 'running' && details.playState != 'finished')
    return;

  const isFinished = () => {
    const playbackRate = effectivePlaybackRate(details);
    const currentTime = details.animation.currentTime;
    if (playbackRate < 0 && currentTime <= 0)
      return true;
    if (playbackRate > 0 &&
        currentTime >= details.animation.effect.getTiming().duration)
      return true;

    return false;
  };

  const newPlayState = isFinished() ? 'finished' : 'running';
  if (newPlayState == details.playSAtate)
    return;

  details.playState = newPlayState;
  if (newPlayState == 'finished') {
    requestAnimationFrame(() => {
      // Finished state may have been temporary. Ensure that we are still in the
      // 'finished' state.
      if (details.playState == 'finished') {
        // Resolve the finished promise and queue the onfinished event.
        // Finish snaps to the boundary. Restore current time after the finish
        // call.
        const previousCurrentTime = details.aniamtion.currentTime;
        details.animation.finish();
        details.animation.pause();
        details.animation.currentTime = previousCurrentTime;
      }
    });
  }
}

function hasActiveTimeline(details) {
  return !details.timeline || details.timeline.phase != 'inactive';
}

function tickAnimation(timelineTime) {
  const details = proxyAnimations.get(this);
  if (timelineTime == null) {
    // While the timeline is inactive, it's effect should not be applied.
    // To polyfill this behavior, we cancel the underlying animation.
    if (details.animation.playState != 'idle')
      details.animation.cancel();
    return;
  }

  if (this.playState == 'running') {
    details.animation.currentTime =
        (timelineTime - this.startTime) * this.playbackRate;
    updateFinishedState(details);
  }
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
    // If we explicitly set a null timeline we will return the underlying
    // animation's timeline.
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
          removeAnimation(details.timeline, details.animation);
          break;

        case 'running':
        case 'finished':
          details.playState = previousPlayState;
          details.startTime =
              playbackRate < 0 ? details.animation.effect.getTiming().duration
                               : 0;
          details.holdTime =
              previousPlayState == 'finished' ? previousCurrentTime : null;
          addAnimation(details.timeline, details.animation,
              tickAnimation.bind(this));
          break;
      }
      if (pending)
        createReadyPromise(details);
      return;
    }



    if (details.animation.timeline == newTimeline) {
      if (fromScrollTimeline) {
        details.timeline = null;
        details.animation.currentTime = previousCurrentTime;
        switch (details.playbackRate) {
          case 'paused':
            details.animation.pause();
            break;

          case 'running':
          case 'finished':
            details.animation.play();
        }
      }
    } else {
      throw TypeError("Unsupported timeilne: " + newTimeline);
    }
  }

  get startTime() {
    const details = proxyAnimations.get(this);
    if (details.timeline)
      return details.startTime;

    return details.animation.startTime;
  }
  set startTime(value) {
    // https://drafts.csswg.org/web-animations/#setting-the-start-time-of-an-animation
    const details = proxyAnimations.get(this);
    if (!details.timeline) {
      details.animation.startTime = value;
      return;
    }

    // TODO: handle hold phase.
    const timelineTime = details.timeline.currentTime;
    if (timelineTime === null && value !== null)
      details.holdTime = null;

    const previousCurrentTime = this.currentTime;
    applyPendingPlaybackRate(details);
    details.startTime = value;
    details.resetCurrentTimeOnResume = false;
    details.readyPromise = null;

    if (value === null) {
      details.holdTime = previousCurrentTime;
      details.playState = (previousCurrentTime === null) ? 'idle' : 'paused';
    } else {
      details.playState = 'running';
      if (timelineTime !== null) {
        details.animation.currentTime =
            (timelineTime - value) * this.playbackRate;
        updateFinishedState(details);
      }
    }
  }

  get currentTime() {
    const details = proxyAnimations.get(this);
    if (!details.timeline)
      return details.animation.currentTime;

    if (!details.playState || details.playState == 'idle')
      return null;
    if (details.playState == 'running' &&
        details.timeline.phase == 'inactive')
      return null;

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
    updateFinishedState(details);
  }

  get playState() {
    proxy = proxyAnimations.get(this);
    if (proxy.timeline)
      return proxy.playState;

    return proxy.animation.playState;
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

    addAnimation(details.timeline, details.animation,
                 tickAnimation.bind(this));
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
      // paused state. Update the proxy's ready promise to make it's state
      // (pending/resolved) observable.  Currently, we reset the promise to
      // null when resolved.
      return null;
    }

    return details.animation.ready;
  }

};

export function animate(keyframes, options) {
  const timeline = options.timeline;
  if (timeline instanceof ScrollTimeline)
    delete options.timeline;

  const animation = nativeElementAnimate.apply(this, [keyframes, options]);
  const proxyAnimation = new ProxyAnimation(animation, timeline);

  if (timeline instanceof ScrollTimeline) {
    animation.pause();
    proxyAniamtion.play();
  }

  return proxyAnimation;
};
