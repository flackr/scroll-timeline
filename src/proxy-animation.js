import {
  ScrollTimeline,
  installScrollOffsetExtension,
  addAnimation,
  removeAnimation
} from "./scroll-timeline-base";

const nativeElementAnimate = window.Element.prototype.animate;
const nativeAnimation = window.Animation;

class PromiseWrapper {
  constructor() {
    this.state = 'pending';
    this.nativeResolve = this.nativeReject = null;
    this.promise = new Promise((resolve, reject) => {
      this.nativeResolve = resolve;
      this.nativeReject = reject;
    });
  }
  resolve(value) {
    this.state = 'resolved';
    this.nativeResolve(value);
  }
  reject(reason) {
    this.state = 'rejected';
    // Do not report unhandled promise rejections.
    this.promise.catch(() => {});
    this.nativeReject(reason);
  }
}

function createReadyPromise(details) {
  details.readyPromise = new PromiseWrapper();
  // Trigger the pending task on the next animation frame.
  requestAnimationFrame(() => {
    const timelineTime = details.timeline.currentTime;
    if (timelineTime !== null)
      notifyReady(details);
  });
}

function createAbortError() {
  return new DOMException("The user aborted a request", "AbortError");
}

// Converts a time from its internal representation to a percent. For a
// monotonic timeline, time is reported as a double with implicit units of
// milliseconds. For progress-based animations, times are reported as
// percentages.
function toCssNumberish(details, value) {
  if (value === null)
    return value;

  if (typeof value !== 'number') {
      throw new DOMException(
          `Unexpected value: ${value}.  Cannot convert to CssNumberish`,
          "InvalidStateError");
  }

  const limit = effectEnd(details);
  const percent = limit ? 100 * value / limit : 0;
  return CSS.percent(percent);
}

// Covnerts a time to its internal representation. Progress-based animations
// use times expressed as percentages. Each progress-based animation is backed
// by a native animation with a document timeline in the polyfill. Thus, we
// need to convert the timing from percent to milliseconds with implicit units.
function fromCssNumberish(details, value) {
  if (!details.timeline) {
    // Document timeline
    if (value == null || typeof value === 'number')
      return value;

    const convertedTime = value.to('ms');
    if (convertTime)
      return convertedTime.value;

    throw new DOMException(
        "CSSNumericValue must be either a number or a time value for " +
        "time based animations.",
        "InvalidStateError");
  } else {
    // Scroll timeline.
    if (value === null)
      return value;

    if (value.unit === 'percent') {
      const duration = effectEnd(details);
      return value.value * duration / 100;
    }

    throw new DOMException(
        "CSSNumericValue must be a percentage for progress based animations.",
        "NotSupportedError");
  }
}

function normalizedTiming(details) {
  // Used normalized timing in the case of a progress-based animation or
  // specified timing with a document timeline.  The normalizedTiming property
  // is initialized and cached when fetching the timing information.
  const timing = details.proxy.effect.getTiming();
  return details.normalizedTiming || timing;
}

function commitPendingPlay(details)  {
  // https://drafts4.csswg.org/web-animations-2/#playing-an-animation-section
  // Refer to steps listed under "Schedule a task to run ..."

  const timelineTime = fromCssNumberish(details, details.timeline.currentTime);
  if (details.holdTime != null) {
    // A: If animation’s hold time is resolved,
    // A.1. Apply any pending playback rate on animation.
    // A.2. Let new start time be the result of evaluating:
    //        ready time - hold time / playback rate for animation.
    //      If the playback rate is zero, let new start time be simply ready
    //      time.
    // A.3. Set the start time of animation to new start time.
    // A.4. If animation’s playback rate is not 0, make animation’s hold
    //      time unresolved.
    applyPendingPlaybackRate(details);
    if (details.animation.playbackRate == 0) {
      details.startTime = timelineTime;
    } else {
      details.startTime
          = timelineTime -
              details.holdTime / details.animation.playbackRate;
      details.holdTime = null;
    }
  } else if (details.startTime !== null &&
             details.pendingPlaybackRate !== null) {
    // B: If animation’s start time is resolved and animation has a pending
    //    playback rate,
    // B.1. Let current time to match be the result of evaluating:
    //        (ready time - start time) × playback rate for animation.
    // B.2 Apply any pending playback rate on animation.
    // B.3 If animation’s playback rate is zero, let animation’s hold time
    //     be current time to match.
    // B.4 Let new start time be the result of evaluating:
    //       ready time - current time to match / playback rate
    //     for animation.
    //     If the playback rate is zero, let new start time be simply ready
    //     time.
    // B.5 Set the start time of animation to new start time.
    const currentTimeToMatch =
        (timelineTime - details.startTime) * details.animation.playbackRate;
    applyPendingPlaybackRate(details);
    const playbackRate = details.animation.playbackRate;
    if (playbackRate == 0) {
      details.holdTime = null;
      details.startTime = timelineTime;
    } else {
      details.startTime = timelineTime - currentTimeToMatch / playbackRate;
    }
  }

  // 8.4 Resolve animation’s current ready promise with animation.
  if (details.readyPromise && details.readyPromise.state == 'pending')
     details.readyPromise.resolve(details.proxy);

  // 8.5 Run the procedure to update an animation’s finished state for
  //     animation with the did seek flag set to false, and the
  //     synchronously notify flag set to false.
  updateFinishedState(details, false, false);

  // Additional polyfill step to update the native animation's current time.
  syncCurrentTime(details);
  details.pendingTask = null;
};

function commitPendingPause(details) {
  // https://www.w3.org/TR/web-animations-1/#pausing-an-animation-section
  // Refer to steps listed under "Schedule a task to run ..."

  // 1. Let ready time be the time value of the timeline associated with
  //    animation at the moment when the user agent completed processing
  //    necessary to suspend playback of animation’s target effect.
  const readyTime = fromCssNumberish(details, details.timeline.currentTime);

  // 2. If animation’s start time is resolved and its hold time is not
  //    resolved, let animation’s hold time be the result of evaluating
  //    (ready time - start time) × playback rate.
  if (details.startTime != null && details.holdTime == null) {
    details.holdTime =
        (readyTime - details.startTime) * details.animation.playbackRate;
  }

  // 3. Apply any pending playback rate on animation.
  applyPendingPlaybackRate(details);

  // 4. Make animation’s start time unresolved.
  details.startTime = null;

  // 5. Resolve animation’s current ready promise with animation.
  details.readyPromise.resolve(details.proxy);

  // 6. Run the procedure to update an animation’s finished state for
  // animation with the did seek flag set to false, and the synchronously
  //  notify flag set to false.
  updateFinishedState(details, false, false);

  // Additional polyfill step to update the native animation's current time.
  syncCurrentTime(details);
  details.pendingTask = null;
};

function commitFinishedNotification(details) {
  if (!details.finishedPromise || details.finishedPromise.state != 'pending')
    return;

  if (details.proxy.playState != 'finished')
    return;

  details.finishedPromise.resolve(details.proxy);

  details.animation.pause();

  // Event times are speced as doubles in web-animations-1.
  // Cannot dispatch a proxy to an event since the proxy is not a fully
  // transparent replacement. As a workaround, use a custom event and inject
  // the necessary getters.
  const finishedEvent =
    new CustomEvent('finish',
                    { detail: {
                      currentTime: details.proxy.currentTime,
                      timelineTime: details.proxy.timeline.currentTime
                    }});
  Object.defineProperty(finishedEvent, 'currentTime', {
    get: function() { return this.detail.currentTime; }
  });
  Object.defineProperty(finishedEvent, 'timelineTime', {
    get: function() { return this.detail.timelineTime; }
  });

  requestAnimationFrame(() => {
    queueMicrotask(() => {
      details.animation.dispatchEvent(finishedEvent);
    });
  });
}

function effectivePlaybackRate(details) {
  if (details.pendingPlaybackRate !== null)
    return details.pendingPlaybackRate;
  return details.animation.playbackRate;
}

function applyPendingPlaybackRate(details) {
  if (details.pendingPlaybackRate !== null) {
    details.animation.playbackRate = details.pendingPlaybackRate;
    details.pendingPlaybackRate = null;
  }
}

function calculateCurrentTime(details) {
  if (!details.timeline)
    return null;

  const timelineTime = fromCssNumberish(details, details.timeline.currentTime);
  if (timelineTime === null)
    return null;

  if (details.startTime === null)
    return null;

  let currentTime =
      (timelineTime - details.startTime) * details.animation.playbackRate;

  // Handle special case.
  if (currentTime == -0)
    currentTime = 0;

  return currentTime;
}

function calculateStartTime(details, currentTime) {
  if (!details.timeline)
    return null;

  const timelineTime = fromCssNumberish(details, details.timeline.currentTime);
  if (timelineTime == null)
    return null;

  return timelineTime - currentTime / details.animation.playbackRate;
}

function updateFinishedState(details, didSeek, synchronouslyNotify) {
  if (!details.timeline)
    return;

  // https://www.w3.org/TR/web-animations-1/#updating-the-finished-state
  // 1. Calculate the unconstrained current time. The dependency on did_seek is
  // required to accommodate timelines that may change direction. Without this
  // distinction, a once-finished animation would remain finished even when its
  // timeline progresses in the opposite direction.
  let unconstrainedCurrentTime =
      didSeek ? fromCssNumberish(details, details.proxy.currentTime)
              : calculateCurrentTime(details);

  // 2. Conditionally update the hold time.
  if (unconstrainedCurrentTime && details.startTime != null &&
      !details.proxy.pending) {
    // Can seek outside the bounds of the active effect. Set the hold time to
    // the unconstrained value of the current time in the event that this update
    // is the result of explicitly setting the current time and the new time
    // is out of bounds. An update due to a time tick should not snap the hold
    // value back to the boundary if previously set outside the normal effect
    // boundary. The value of previous current time is used to retain this
    // value.
    const playbackRate = effectivePlaybackRate(details);
    const upperBound = effectEnd(details);
    let boundary = details.previousCurrentTime;
    // TODO: Support hold phase.
    if (playbackRate > 0 && unconstrainedCurrentTime >= upperBound) {
      if (boundary === null || boundary < upperBound)
        boundary = upperBound;
      details.holdTime = didSeek ? unconstrainedCurrentTime : boundary;
    } else if (playbackRate < 0 && unconstrainedCurrentTime <= 0) {
      if (boundary == null || boundary > 0)
        boundary = 0;
      details.holdTime = didSeek ? unconstrainedCurrentTime : boundary;
    } else if (playbackRate != 0) {
      // Update start time and reset hold time.
      if (didSeek && details.holdTime !== null)
        details.startTime = calculateStartTime(details, details.holdTime);
      details.holdTime = null;
    }
  }

  // Additional step to ensure that the native animation has the same value for
  // current time as the proxy.
  syncCurrentTime(details);

  // 3. Set the previous current time.
  details.previousCurrentTime = fromCssNumberish(details,
                                                 details.proxy.currentTime);

  // 4. Set the current finished state.
  const playState = details.proxy.playState;

  if (playState == 'finished') {
    if (!details.finishedPromise)
      details.finishedPromise = new PromiseWrapper();
    if (details.finishedPromise.state == 'pending') {
      // 5. Setup finished notification.
      if (synchronouslyNotify) {
        commitFinishedNotification(details);
      } else {
        Promise.resolve().then(() => {
          commitFinishedNotification(details);
        });
      }
    }
  } else {
    // 6. If not finished but the current finished promise is already resolved,
    //    create a new promise.
    if (details.finishedPromise &&
        details.finishedPromise.state == 'resolved') {
      details.finishedPromise = new PromiseWrapper();
    }
    if (details.animation.playState != 'paused')
      details.animation.pause();
  }
}

function effectEnd(details) {
  // https://www.w3.org/TR/web-animations-1/#end-time
  const timing = normalizedTiming(details);
  const totalDuration =
     timing.delay + timing.endDelay + timing.iterations * timing.duration;

  return Math.max(0, totalDuration);
}

function hasActiveTimeline(details) {
  return !details.timeline || details.timeline.phase != 'inactive';
}

function syncCurrentTime(details) {
  if (!details.timeline)
    return;

  if (details.startTime !== null) {
    const timelineTime = fromCssNumberish(details,
                                          details.timeline.currentTime);
    details.animation.currentTime =
        (timelineTime - details.startTime) *
            details.animation.playbackRate;
  } else if (details.holdTime !== null) {
    details.animation.currentTime = details.holdTime;
  }
}

function resetPendingTasks(details) {
  // https://www.w3.org/TR/web-animations-1/#reset-an-animations-pending-tasks

  // 1. If animation does not have a pending play task or a pending pause task,
  //    abort this procedure.
  if (!details.pendingTask)
    return;

  // 2. If animation has a pending play task, cancel that task.
  // 3. If animation has a pending pause task, cancel that task.
  details.pendingTask = null;

  // 4. Apply any pending playback rate on animation.
  applyPendingPlaybackRate(details);

  // 5. Reject animation’s current ready promise with a DOMException named
  //    "AbortError".
  details.readyPromise.reject(createAbortError());

  // 6. Let animation’s current ready promise be the result of creating a new
  //    resolved Promise object.
  createReadyPromise(details);
  details.readyPromise.resolve(details.proxy);
}

function playInternal(details, autoRewind) {
  if (!details.timeline)
    return;

  // https://drafts.csswg.org/web-animations/#playing-an-animation-section.
  // 1. Let aborted pause be a boolean flag that is true if animation has a
  //    pending pause task, and false otherwise.
  const abortedPause =
     details.proxy.playState == 'paused' && details.proxy.pending;

  // 2. Let has pending ready promise be a boolean flag that is initially
  //    false.
  let hasPendingReadyPromise = false;

  // 3. Let seek time be a time value that is initially unresolved.
  let seekTime = null;

  // 4. Let has finite timeline be true if animation has an associated
  //    timeline that is not monotonically increasing.
  //    Note: this value will always true at this point in the polyfill.
  //    Following steps are pruned based on the procedure for scroll
  //    timelines.

  // 5. Perform the steps corresponding to the first matching condition from
  //    the following, if any:
  //
  // 5a If animation’s effective playback rate > 0, the auto-rewind flag is
  //    true and either animation’s:
  //      current time is unresolved, or
  //      current time < zero, or
  //      current time >= target effect end,
  //    5a1. Set seek time to zero.
  //
  // 5b If animation’s effective playback rate < 0, the auto-rewind flag is
  //    true and either animation’s:
  //      current time is unresolved, or
  //      current time ≤ zero, or
  //      current time > target effect end,
  //    5b1. If associated effect end is positive infinity,
  //         throw an "InvalidStateError" DOMException and abort these steps.
  //    5b2. Otherwise,
  //         5b2a Set seek time to animation's associated effect end.
  //
  // 5c If animation’s effective playback rate = 0 and animation’s current time
  //    is unresolved,
  //    5c1. Set seek time to zero.
  let previousCurrentTime = fromCssNumberish(details,
                                             details.proxy.currentTime);

  // Resume of a paused animation after a timeline change snaps to the scroll
  // position.
  if (details.resetCurrentTimeOnResume) {
    previousCurrentTime = null;
    details.resetCurrentTimeOnResume = false;
  }

  const playbackRate = effectivePlaybackRate(details);
  const upperBound = effectEnd(details);
  if (playbackRate > 0 && autoRewind && (previousCurrentTime == null ||
                                         previousCurrentTime < 0 ||
                                         previousCurrentTime >= upperBound)) {
    seekTime = 0;
  } else if (playbackRate < 0 && autoRewind &&
             (previousCurrentTime == null || previousCurrentTime <= 0 ||
             previousCurrentTime > upperBound)) {
    if (upperBound == Infinity) {
      // Defer to native implementation to handle throwing the exception.
      details.animation.play();
      return;
    }
    seekTime = upperBound;
  } else if (playbackRate == 0 && previousCurrentTime == null) {
    seekTime = 0;
  }

  // 6. If seek time is resolved,
  //        6a1. Set animation's start time to seek time.
  //        6a2. Let animation's hold time be unresolved.
  //        6a3. Apply any pending playback rate on animation.
  if (seekTime != null) {
    details.startTime = seekTime;
    details.holdTime = null;
    applyPendingPlaybackRate(details);
  }

  // Additional step for the polyfill.
  addAnimation(details.timeline, details.animation,
               tickAnimation.bind(details.proxy));

  // 7. If animation's hold time is resolved, let its start time be
  //    unresolved.
  if (details.holdTime) {
    details.startTime = null;
  }

  // 8. If animation has a pending play task or a pending pause task,
  //   8.1 Cancel that task.
  //   8.2 Set has pending ready promise to true.
  if (details.pendingTask) {
    details.pendingTask = null;
    hasPendingReadyPromise = true;
  }

  // 9. If the following three conditions are all satisfied:
  //      animation’s hold time is unresolved, and
  //      seek time is unresolved, and
  //      aborted pause is false, and
  //      animation does not have a pending playback rate,
  //    abort this procedure.
  if (details.holdTime === null && seekTime === null &&
      !abortedPause && details.pendingPlaybackRate === null)
  return;

  // 10. If has pending ready promise is false, let animation’s current ready
  //    promise be a new promise in the relevant Realm of animation.
  if (details.readyPromise && !hasPendingReadyPromise)
    details.readyPromise = null;

  // Additional polyfill step to ensure that the native animation has the
  // correct value for current time.
  syncCurrentTime(details);

  // 11. Schedule a task to run as soon as animation is ready.
  if (!details.readyPromise)
    createReadyPromise(details);
  details.pendingTask = 'play';

  // 12. Run the procedure to update an animation’s finished state for animation
  //     with the did seek flag set to false, and the synchronously notify flag
  //     set to false.
  updateFinishedState(details, /* seek */ false, /* synchronous */ false);
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

  if (details.pendingTask) {
    notifyReady(details);
  }

  const playState = this.playState;
  if (playState == 'running' || playState == 'finished') {
    const timelineTimeMs = fromCssNumberish(details, timelineTime);

    details.animation.currentTime =
        (timelineTimeMs - fromCssNumberish(details, this.startTime)) *
            this.playbackRate;

    // Conditionally reset the hold time so that the finished state can be
    // properly recomputed.
    if (playState == 'finished' && effectivePlaybackRate(details) != 0)
      details.holdTime = null;
    updateFinishedState(details, false, false);
  }
}

function notifyReady(details) {
  if (details.pendingTask == 'pause') {
    commitPendingPause(details);
  } else if (details.pendingTask == 'play') {
    commitPendingPlay(details);
  }
}

function createProxyEffect(details) {
  const effect = details.animation.effect;
  const nativeUpdateTiming = effect.updateTiming;

  // Generic pass-through handler for any method or attribute that is not
  // explicitly overridden.
  const handler = {
    get: function(obj, prop) {
      const result = obj[prop];
      if (typeof result === 'function')
        return result.bind(effect);
      return result;
    },

    set: function(obj, prop, value) {
      obj[prop] = value;
      return true;
    }
  };
  // Override getComputedTiming to convert to percentages when using a
  // progress-based timeline.
  const getComputedTimingHandler = {
    apply: function(target) {
      // Ensure that the native animation is using normalized values.
      effect.getTiming();

      const timing = target.apply(effect);

      if (details.timeline) {
        const preConvertLocalTime = timing.localTime;
        timing.localTime = toCssNumberish(details, timing.localTime);
        timing.endTime = toCssNumberish(details, timing.endTime);
        timing.activeDuration =
            toCssNumberish(details, timing.activeDuration);
        const limit = effectEnd(details);
        const iteration_duration = timing.iterations ?
            (limit - timing.delay - timing.endDelay) / timing.iterations : 0;
        timing.duration = limit ?
            CSS.percent(100 * iteration_duration / limit) :
            CSS.percent(0);

        // Correct for timeline phase.
        const phase = details.timeline.phase;
        const fill = timing.fill;

        if(phase == 'before' && fill != 'backwards' && fill != 'both') {
          timing.progress = null;
        }
        if (phase == 'after' && fill != 'forwards' && fill != 'both') {
          timing.progress = null;
        }

        // Correct for inactive timeline.
        if (details.timeline.currentTime === undefined) {
          timing.localTime = null;
        }
      }
      return timing;
    }
  };
  // Override getTiming to normalize the timing. EffectEnd for the animation
  // align with the timeline duration.
  const getTimingHandler = {
    apply: function(target, thisArg) {
      // Arbitrary conversion of 100% to ms.
      const INTERNAL_DURATION_MS = 100000;

      if (details.specifiedTiming)
        return details.specifiedTiming;

      details.specifiedTiming = target.apply(effect);
      let timing = Object.assign({}, details.specifiedTiming);

      let totalDuration;

      // Duration 'auto' case.
      if (timing.duration === null || timing.duration === 'auto') {
        if (details.timeline) {
          // TODO: start and end delay are specced as doubles and currently
          // ignored for a progress based animation. Support delay and endDelay
          // once CSSNumberish.
          timing.delay = 0;
          timing.endDelay = 0;
          totalDuration = timing.iterations ? INTERNAL_DURATION_MS : 0;
          timing.duration =
              timing.iterations ? totalDuration / timing.iterations : 0;
          // Set the timing on the native animation to the normalized values
          // while preserving the specified timing.
          nativeUpdateTiming.apply(effect, [timing]);
        }
      }
      details.normalizedTiming = timing;
      return details.specifiedTiming;
    }
  };
  const updateTimingHandler = {
    apply: function(target, thisArg, argumentsList) {
      // Additional validation that is specific to scroll timelines.
      if (details.timeline) {
        const options = argumentsList[0];
        const duration = options.duration;
        if (duration === Infinity) {
          throw TypeError(
              "Effect duration cannot be Infinity when used with Scroll " +
              "Timelines");
        }
        const iterations = options.iterations;
        if (iterations === Infinity) {
          throw TypeError(
            "Effect iterations cannot be Infinity when used with Scroll " +
            "Timelines");
        }
      }

      // Apply updates on top of the original specified timing.
      if (details.specifiedTiming) {
        target.apply(effect, [details.specifiedTiming]);
      }
      target.apply(effect, argumentsList);
      // Force renormalization.
      details.specifiedTiming = null;
    }
  };
  const proxy = new Proxy(effect, handler);
  proxy.getComputedTiming = new Proxy(effect.getComputedTiming,
                                      getComputedTimingHandler);
  proxy.getTiming = new Proxy(effect.getTiming, getTimingHandler);
  proxy.updateTiming = new Proxy(effect.updateTiming, updateTimingHandler);
  return proxy;
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
      finishedPromise: null,
      // Start and hold times are directly tracked in the proxy despite being
      // accessible via the animation so that direct manipulation of these
      // properties does not affect the play state of the underlying animation.
      // Note that any changes to these values require an update of current
      // time for the underlying animation to ensure that its hold time is set
      // to the correct position. These values are represented as floating point
      // numbers in milliseconds.
      startTime: null,
      holdTime: null,
      previousCurrentTime: null,
      // When changing the timeline on a paused animation, we defer updating the
      // start time until the animation resumes playing.
      resetCurrentTimeOnResume: false,
      // Calls to reverse and updatePlaybackRate set a pending rate that does
      // not immediately take effect. The value of this property is
      // inaccessible via the web animations API and therefore explicitly
      // tracked.
      pendingPlaybackRate: null,
      pendingTask: null,
      // Record the specified timing since it may be different than the timing
      // actually used for the animation. When fetching the timing, this value
      // will be returned, however, the native animation will use normalized
      // values.
      specifiedTiming: null,
      // The normalized timing has the corrected timing with the intrinsic
      // iteration duration resolved.
      normalizedTiming: null,
      // Effect proxy that performs the necessary time conversions when using a
      // progress-based timelines.
      effect: null,
      proxy: this
    });
  }

  // -----------------------------------------
  // Web animation API
  // -----------------------------------------

  get effect() {
    const details = proxyAnimations.get(this);
    if (!details.timeline)
      return details.animation.effect;

    // Proxy the effect to support timing conversions for progress based
    // animations.
    if (!details.effect)
      details.effect = createProxyEffect(details);

    return details.effect;
  }
  set effect(newEffect) {
    proxyAnimations.get(this).animation.effect = newEffect;
    // Reset proxy to force re-initialization the next time it is accessed.
    details.effect = null;
  }

  get timeline() {
    const details = proxyAnimations.get(this);
    // If we explicitly set a null timeline we will return the underlying
    // animation's timeline.
    return details.timeline || details.animation.timeline;
  }
  set timeline(newTimeline) {
    // https://drafts4.csswg.org/web-animations-2/#setting-the-timeline

    // 1. Let old timeline be the current timeline of animation, if any.
    // 2. If new timeline is the same object as old timeline, abort this
    //    procedure.
    const oldTimeline = this.timeline;
    if (oldTimeline == newTimeline)
      return;

    // 3. Let previous play state be animation’s play state.
    const previousPlayState = this.playState;

    // 4. Let previous current time be the animation’s current time.
    const previousCurrentTime = this.currentTime;

    const details = proxyAnimations.get(this);
    const end = effectEnd(details);
    const progress =
        end > 0 ? fromCssNumberish(details, previousCurrentTime) / end : 0;

    // 5. Let from finite timeline be true if old timeline is not null and not
    //    monotonically increasing.
    const fromScrollTimeline = (oldTimeline instanceof ScrollTimeline);

    // 6. Let to finite timeline be true if timeline is not null and not
    //    monotonically increasing.
    const toScrollTimeline = (newTimeline instanceof ScrollTimeline);

    // 7. Let the timeline of animation be new timeline.
    // Cannot assume that the native implementation has mutable timeline
    // support. Deferring this step until we know that we are either
    // polyfilling, supporting natively, or throwing an error.

    // 8. Set the flag reset current time on resume to false.
    details.resetCurrentTimeOnResume = false;

    // Additional step required to track whether the animation was pending in
    // order to set up a new ready promise if needed.
    const pending = this.pending;

    if (fromScrollTimeline) {
      removeAnimation(details.timeline, details.animation);
    }

    // 9. Perform the steps corresponding to the first matching condition from
    //    the following, if any:

    // If to finite timeline,
    if (toScrollTimeline) {
      // Deferred step 7.
      details.timeline = newTimeline;

      // 1. Apply any pending playback rate on animation
      applyPendingPlaybackRate(details);

      // 2. Let seek time be zero if playback rate >= 0, and animation’s
      //    associated effect end otherwise.
      const seekTime =
          details.animation.playbackRate >= 0 ? 0 : effectEnd(details);

      // 3.  Update the animation based on the first matching condition if any:
      switch (previousPlayState) {
        //   If either of the following conditions are true:
        //     * previous play state is running or,
        //     * previous play state is finished
        //   Set animation’s start time to seek time.
        case 'running':
        case 'finished':
          details.startTime = seekTime;
          // Additional polyfill step needed to associate the animation with
          // the scroll timeline.
          addAnimation(details.timeline, details.animation,
                       tickAnimation.bind(this));
          break;

        //   If previous play state is paused:
        //     If previous current time is resolved:
        //       * Set the flag reset current time on resume to true.
        //       * Set start time to unresolved.
        //       * Set hold time to previous current time.
        case 'paused':
          details.resetCurrentTimeOnResume = true;
          details.startTime = null;
          details.holdTime =
              fromCssNumberish(details, CSS.percent(100 * progress));
          break;

        // Oterwise
        default:
          details.holdTime = null;
          details.startTime = null;
      }

      // Additional steps required if the animation is pending as we need to
      // associate the pending promise with proxy animation.
      // Note: if the native promise already has an associated "then", we will
      // lose this association.
      if (pending) {
        if (!details.readyPromise ||
            details.readyPromise.state == 'resolved') {
          createReadyPromise(details);
        }
        if (previousPlayState == 'paused')
          details.pendingTask = 'pause';
        else
          details.pendingTask = 'play';
      }

      // Note that the following steps should apply when transitioning to
      // a monotonic timeline as well; however, we do not have a direct means
      // of applying the steps to the native animation.

      // 10. If the start time of animation is resolved, make animation’s hold
      //     time unresolved. This step ensures that the finished play state of
      //     animation is not “sticky” but is re-evaluated based on its updated
      //     current time.
      if (details.startTime !== null)
        details.holdTime = null;

      // 11. Run the procedure to update an animation’s finished state for
      //     animation with the did seek flag set to false, and the
      //     synchronously  notify flag set to false.
      updateFinishedState(details, false, false);
      return;
    }

    // To monotonic timeline.
    if (details.animation.timeline == newTimeline) {
      // Deferred step 7 from above.  Clearing the proxy's timeline will
      // re-associate the proxy with the native animation.
      removeAnimation(details.timeline, details.animation);
      details.timeline = null;

      // If from finite timeline and previous current time is resolved,
      //   Run the procedure to set the current time to previous current time.
      if (fromScrollTimeline) {
        if (previousCurrentTime !== null)
          details.animation.currentTime = progress * effectEnd(details);

        switch (previousPlayState) {
          case 'paused':
            details.animation.pause();
            break;

          case 'running':
          case 'finished':
            details.animation.play();
        }
      }
    } else {
      throw TypeError("Unsupported timeline: " + newTimeline);
    }
  }

  get startTime() {
    const details = proxyAnimations.get(this);
    if (details.timeline)
      return toCssNumberish(details, details.startTime);

    return details.animation.startTime;
  }
  set startTime(value) {
    // https://drafts.csswg.org/web-animations/#setting-the-start-time-of-an-animation
    const details = proxyAnimations.get(this);
    value = fromCssNumberish(details, value);
    if (!details.timeline) {
      details.animation.startTime = value;
      return;
    }

    // 1. Let timeline time be the current time value of the timeline that
    //    animation is associated with. If there is no timeline associated with
    //    animation or the associated timeline is inactive, let the timeline
    //    time be unresolved.
    const timelineTime = fromCssNumberish(details,
                                          details.timeline.currentTime);

    // 2. If timeline time is unresolved and new start time is resolved, make
    //    animation’s hold time unresolved.
    if (timelineTime == null && details.startTime != null) {
      details.holdTime = null;
      // Clearing the hold time may have altered the value of current time.
      // Ensure that the underlying animations has the correct value.
      syncCurrentTime(details);
    }

    // 3. Let previous current time be animation’s current time.
    // Note: This is the current time after applying the changes from the
    // previous step which may cause the current time to become unresolved.
    const previousCurrentTime = fromCssNumberish(details, this.currentTime);

    // 4. Apply any pending playback rate on animation.
    applyPendingPlaybackRate(details);

    // 5. Set animation’s start time to new start time.
    details.startTime = value;

    // 6. Set the reset current time on resume flag to false.
    details.resetCurrentTimeOnResume = false;

    // 7. Update animation’s hold time based on the first matching condition
    //    from the following,

    //    If new start time is resolved,
    //    If animation’s playback rate is not zero,
    //       make animation’s hold time unresolved.

    //    Otherwise (new start time is unresolved),
    //        Set animation’s hold time to previous current time even if
    //        previous current time is unresolved.

    if (details.startTime !== null && details.animation.playbackRate != 0)
      details.holdTime = null;
    else
      details.holdTime = previousCurrentTime;

    // 7. If animation has a pending play task or a pending pause task, cancel
    //    that task and resolve animation’s current ready promise with
    //    animation.
    if (details.pendingTask) {
      details.pendingTask = null;
      details.readyPromise.resolve(this);
    }

   // 8. Run the procedure to update an animation’s finished state for animation
   //    with the did seek flag set to true, and the synchronously notify flag
   //    set to false.
   updateFinishedState(details, true, false);

    // Ensure that currentTime is updated for the native animation.
    syncCurrentTime(details);
  }

  get currentTime() {
    const details = proxyAnimations.get(this);
    if (!details.timeline)
      return details.animation.currentTime;

    if (details.holdTime != null)
      return toCssNumberish(details, details.holdTime);

    return toCssNumberish(details, calculateCurrentTime(details));
  }
  set currentTime(value) {
    const details = proxyAnimations.get(this);
    value = fromCssNumberish(details, value);
    if (!details.timeline || value == null) {
      details.animation.currentTime = value;
      return;
    }

    // https://drafts.csswg.org/web-animations/#setting-the-current-time-of-an-animation
    const previouStartTime = details.startTime;
    const previousHoldTime = details.holdTime;
    const timelinePhase = details.timeline.phase;

    // Update either the hold time or the start time.
    if (details.holdTime !== null || details.startTime === null ||
        timelinePhase == 'inactive' || details.animation.playbackRate == 0) {
      // TODO: Support hold phase.
      details.holdTime = value;
    } else {
      details.startTime = calculateStartTime(details, value);
    }
    details.resetCurrentTimeOnResume = false;

    // Preserve invariant that we can only set a start time or a hold time in
    // the absence of an active timeline.
    if (timelinePhase == 'inactive')
      details.startTime = null;

    // Reset the previous current time.
    details.previousCurrentTime = null;

    // Synchronously resolve pending pause task.
    if (details.pendingTask == 'pause') {
      details.holdTime = value;
      applyPendingPlaybackRate(details);
      details.startTime = null;
      details.pendingTask = null;
      details.readyPromise.resolve(this);
    }

    // Update the finished state.
    updateFinishedState(details, true, false);
  }

  get playbackRate() {
    return proxyAnimations.get(this).animation.playbackRate;
  }
  set playbackRate(value) {
    const details = proxyAnimations.get(this);

    if (!details.timeline) {
      details.animation.playbackRate = value;
      return;
    }

    // 1. Clear any pending playback rate on animation.
    details.pendingPlaybackRate = null;

    // 2. Let previous time be the value of the current time of animation before
    //    changing the playback rate.
    const previousCurrentTime = this.currentTime;

    // 3. Set the playback rate to new playback rate.
    details.animation.playbackRate = value;

    // 4. If previous time is resolved, set the current time of animation to
    //    previous time
   if (previousCurrentTime !== null)
      this.currentTime = previousCurrentTime;
  }

  get playState() {
    const details = proxyAnimations.get(this);
    if (!details.timeline)
      return details.animation.playState;

    const currentTime = fromCssNumberish(details, this.currentTime);

    // 1. All of the following conditions are true:
    //    * The current time of animation is unresolved, and
    //    * the start time of animation is unresolved, and
    //    * animation does not have either a pending play task or a pending pause
    //      task,
    //    then idle.
    if (currentTime === null && details.startTime === null &&
        details.pendingTask == null)
      return 'idle';

    // 2. Either of the following conditions are true:
    //    * animation has a pending pause task, or
    //    * both the start time of animation is unresolved and it does not have a
    //      pending play task,
    //    then paused.
    if (details.pendingTask == 'pause' ||
        (details.startTime === null && details.pendingTask != 'play'))
      return 'paused';

    // 3.  For animation, current time is resolved and either of the following
    //     conditions are true:
    //     * animation’s effective playback rate > 0 and current time >= target
    //       effect end; or
    //     * animation’s effective playback rate < 0 and current time <= 0,
    //    then finished.
    if (currentTime != null) {
      if (details.animation.playbackRate > 0 &&
          currentTime >= effectEnd(details))
        return 'finished';
      if (details.animation.playbackRate < 0 && currentTime <= 0)
        return 'finished';
    }

    // 4.  Otherwise
    return 'running';
  }
  get replaceState() {
    // TODO: Fix me. Replace state is not a boolean.
    return proxyAnimations.get(this).animation.pending;
  }

  get pending() {
    const details = proxyAnimations.get(this);
    if (details.timeline) {
      return !!details.readyPromise &&
             details.readyPromise.state == 'pending';
    }

    return details.animation.pending;
  }

  finish() {
    const details = proxyAnimations.get(this);
    if (!details.timeline) {
      details.animation.finish();
      return;
    }

    // 1. If animation’s effective playback rate is zero, or if animation’s
    //    effective playback rate > 0 and target effect end is infinity, throw
    //    an InvalidStateError and abort these steps.
    const playbackRate = effectivePlaybackRate(details);
    const duration = effectEnd(details);
    if (playbackRate == 0) {
      throw new DOMException(
          "Cannot finish Animation with a playbackRate of 0.",
          "InvalidStateError");
    }
    if (playbackRate > 0 && duration == Infinity) {
      throw new DOMException(
          "Cannot finish Animation with an infinite target effect end.",
          "InvalidStateError");
    }

    // 2. Apply any pending playback rate to animation.
    applyPendingPlaybackRate(details);

    // 3. Set limit as follows:
    //       If playback rate > 0,
    //          Let limit be target effect end.
    //       Otherwise,
    //          Let limit be zero.
    const limit = playbackRate < 0 ? 0 : duration;

    // 4. Silently set the current time to limit.
    this.currentTime = toCssNumberish(details, limit);

    // 5. If animation’s start time is unresolved and animation has an
    //    associated active timeline, let the start time be the result of
    //    evaluating
    //        timeline time - (limit / playback rate)
    //    where timeline time is the current time value of the associated
    //    timeline.
    const timelineTime = fromCssNumberish(details,
                                          details.timeline.currentTime);

    if (details.startTime === null && timelineTime !== null) {
       details.startTime =
           timelineTime - (limit / details.animation.playbackRate);
    }

    // 6. If there is a pending pause task and start time is resolved,
    //    6.1 Let the hold time be unresolved.
    //    6.2 Cancel the pending pause task.
    //    6.3 Resolve the current ready promise of animation with animation.
    if (details.pendingTask == 'pause' && details.startTime !== null) {
      details.holdTime = null;
      details.pendingTask = null;
      details.readyPromise.resolve(this);
    }

    // 7. If there is a pending play task and start time is resolved, cancel
    //    that task and resolve the current ready promise of animation with
    //    animation.
    if (details.pendingTask == 'play' && details.startTime !== null) {
      details.pendingTask = null;
      details.readyPromise.resolve(this);
    }

    // 8. Run the procedure to update an animation’s finished state for
    //    animation with the did seek flag set to true, and the synchronously
    //    notify flag set to true.
    updateFinishedState(details, true, true);
  }

  play() {
    const details = proxyAnimations.get(this);
    if (!details.timeline) {
      details.animation.play();
      return;
    }

    playInternal(details, /* autoRewind */ true);
  }

  pause() {
    const details = proxyAnimations.get(this);
    if (!details.timeline) {
      details.animation.pause();
      return;
    }

    // https://www.w3.org/TR/web-animations-1/#pausing-an-animation-section

    // 1. If animation has a pending pause task, abort these steps.
    // 2. If the play state of animation is paused, abort these steps.
    if (this.playState == "paused")
      return;

    // 3. Let seek time be a time value that is initially unresolved.
    // 4. Let has finite timeline be true if animation has an associated
    //    timeline that is not monotonically increasing.
    //    Note: always true if we have reached this point in the polyfill.
    //    Pruning following steps to be specific to scroll timelines.
    let seekTime = null;

    // 5.  If the animation’s current time is unresolved, perform the steps
    //     according to the first matching condition from below:
    // 5a. If animation’s playback rate is ≥ 0,
    //       Set seek time to zero.
    // 5b. Otherwise,
    //         If associated effect end for animation is positive infinity,
    //             throw an "InvalidStateError" DOMException and abort these
    //             steps.
    //         Otherwise,
    //             Set seek time to animation's associated effect end.

    const playbackRate = details.animation.playbackRate;
    const duration = effectEnd(details);

    if (details.animation.currentTime === null) {
      if (playbackRate >= 0) {
        seekTime = 0;
      } else if (duration == Infinity) {
        // Let native implementation take care of throwing the exception.
        details.animation.pause();
        return;
      } else {
        seekTime = duration;
      }
    }

    // 6. If seek time is resolved,
    //        If has finite timeline is true,
    //            Set animation's start time to seek time.
    if (seekTime !== null)
      details.startTime = seekTime;

    // 7. Let has pending ready promise be a boolean flag that is initially
    //    false.
    // 8. If animation has a pending play task, cancel that task and let has
    //    pending ready promise be true.
    // 9. If has pending ready promise is false, set animation’s current ready
    //    promise to a new promise in the relevant Realm of animation.
    if (details.pendingTask == 'play')
      details.pendingTask = null;
    else
      details.readyPromise = null;

    // 10. Schedule a task to be executed at the first possible moment after the
    //     user agent has performed any processing necessary to suspend the
    //     playback of animation’s target effect, if any.
    if (!details.readyPromise)
      createReadyPromise(details);
    details.pendingTask ='pause';
  }

  reverse() {
    const details = proxyAnimations.get(this);
    const playbackRate = effectivePlaybackRate(details);
    const previousCurrentTime =
        details.resetCurrentTimeOnResume ?
            null : fromCssNumberish(details, this.currentTime);
    const inifiniteDuration = effectEnd(details) == Infinity;

    // Let the native implementation handle throwing the exception in cases
    // where reversal is not possible. Error cases will not change the state
    // of the native animation.
    const reversable =
       (playbackRate != 0) &&
       (playbackRate <  0 || previousCurrentTime > 0  || !inifiniteDuration);
    if (!details.timeline || !reversable) {
      if (reversable)
        details.pendingPlaybackRate = -effectivePlaybackRate(details);
      details.animation.reverse();
      return;
    }

    if (details.timeline.phase == 'inactive') {
      throw new DOMException(
          "Cannot reverse an animation with no active timeline",
          "InvalidStateError");
    }

    this.updatePlaybackRate(-playbackRate);
    playInternal(details, /* autoRewind */ true);
  }

  updatePlaybackRate(rate) {
    const details = proxyAnimations.get(this);
    details.pendingPlaybackRate = rate;
    if (!details.timeline) {
      details.animation.updatePlaybackRate(rate);
      return;
    }

    // https://drafts.csswg.org/web-animations/#setting-the-playback-rate-of-an-animation

    // 1. Let previous play state be animation’s play state.
    // 2. Let animation’s pending playback rate be new playback rate.
    // Step 2 already performed as we need to record it even when using a
    // monotonic timeline.
    const previousPlayState = this.playState;

    // 3. Perform the steps corresponding to the first matching condition from
    //    below:
    //
    // 3a If animation has a pending play task or a pending pause task,
    //    Abort these steps.
    if (details.readyPromise && details.readyPromise.state == 'pending')
      return;

    switch(previousPlayState) {
      // 3b If previous play state is idle or paused,
      //    Apply any pending playback rate on animation.
      case 'idle':
      case 'paused':
        applyPendingPlaybackRate(details);
        break;

      // 3c If previous play state is finished,
      //    3c.1 Let the unconstrained current time be the result of calculating
      //         the current time of animation substituting an unresolved time
      //          value for the hold time.
      //    3c.2 Let animation’s start time be the result of evaluating the
      //         following expression:
      //    timeline time - (unconstrained current time / pending playback rate)
      // Where timeline time is the current time value of the timeline
      // associated with animation.
      //    3c.3 If pending playback rate is zero, let animation’s start time be
      //         timeline time.
      //    3c.4 Apply any pending playback rate on animation.
      //    3c.5 Run the procedure to update an animation’s finished state for
      //         animation with the did seek flag set to false, and the
      //         synchronously notify flag set to false.

      case 'finished':
        const timelineTime = fromCssNumberish(details,
                                              details.timeline.currentTime);
        const unconstrainedCurrentTime = timelineTime !== null ?
            (timelineTime - details.startTime) * details.animation.playbackRate
            : null;
        if (rate == 0) {
          details.startTime = timelineTime;
        } else {
          details.startTime =
              timelineTime != null && unconstrainedCurrentTime != null ?
                  (timelineTime - unconstrainedCurrentTime) / rate : null;
        }
        applyPendingPlaybackRate(details);
        updateFinishedState(details, false, false);
        syncCurrentTime(details);
        break;

      // 3d Otherwise,
      // Run the procedure to play an animation for animation with the
      // auto-rewind flag set to false.
      default:
        playInternal(details, false);
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
    if (!details.timeline) {
      details.animation.cancel();
      return;
    }

    // https://www.w3.org/TR/web-animations-1/#canceling-an-animation-section
    // 1. If animation’s play state is not idle, perform the following steps:
    //    1.1  Run the procedure to reset an animation’s pending tasks on
    //         animation.
    //    1.2 Reject the current finished promise with a DOMException named
    //        "AbortError"
    //    1.3 Let current finished promise be a new (pending) Promise object.
    //    1.4+ Deferred to native implementation.
    //         TODO: polyfill since timelineTime will be incorrect for the
    //               cancel event. Also, should avoid sending a cancel event if
    //               the native animation is canceled due to the scroll timeline
    //               becoming inactive. This can likely be done by associating
    //               the cancel event with the proxy and not the underlying
    //               animation.
    if (this.playState != 'idle') {
      resetPendingTasks(details);
      if (details.finishedPromise &&
          details.finishedPromise.state == 'pending') {
        details.finishedPromise.reject(createAbortError());
      }
      details.finishedPromise = new PromiseWrapper();
      details.animation.cancel();
    }

    // 2. Make animation’s hold time unresolved.
    // 3. Make animation’s start time unresolved.
    details.startTime = null;
    details.holdTime = null;

    // Extra step in the polyfill the ensure the animation stops ticking.
    removeAnimation(details.timeline, details.animation);
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
    const details = proxyAnimations.get(this);
    if (!details.timeline)
       return details.animation.finished;

    if (!details.finishedPromise) {
      details.finishedPromise = new PromiseWrapper();
    }
    return details.finishedPromise.promise;
  }

  get ready() {
    const details = proxyAnimations.get(this);
    if (!details.timeline)
      return details.animation.ready;

    if (!details.readyPromise) {
      details.readyPromise = new PromiseWrapper();
      details.readyPromise.resolve(this);
    }
    return details.readyPromise.promise;
  }

  // --------------------------------------------------
  // Event target API
  // --------------------------------------------------

  addEventListener(type, callback, options) {
    proxyAnimations.get(this).animation.addEventListener(type, callback,
                                                         options);
  }

  removeEventListener(type, callback, options) {
    proxyAnimations.get(this).animation.removeEventListener(type, callback,
                                                            options);
  }

  dispatchEvent(event) {
    proxyAnimations.get(this).animation.dispatchEvent(event);
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
    proxyAnimation.play();
  }

  return proxyAnimation;
};
