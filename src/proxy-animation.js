import {
  ScrollTimeline,
  installScrollOffsetExtension,
  addAnimation,
  removeAnimation
} from "./scroll-timeline-base";

const nativeElementAnimate = window.Element.prototype.animate;
const nativeAnimation = window.Animation;


/**
 * Creates a ready promise with a pending task, to be executed at the time
 * the promise is resolved. The promise will auto-resolve in the next animation
 * frame, but may be resolved or rejected earlier as a result of API calls that
 * change the state of the animation. The state of the promise
 * (pending|resolved|rejected) may be queried to determine when a replacement
 * promise is needed.
 * @param details {Ojbect}
 * @param task {function}
 */
function createReadyPromise(details) {
  let nativeResolve = undefined;
  let nativeReject = undefined;
  let pendingTask = undefined;
  let pendingTaskName = undefined;
  let state = 'pending';
  const p = new Promise((resolve, reject) => {
    nativeResolve = resolve;
    nativeReject = reject;
  });

  p.resolve = () => {
    state = 'resolved';
    pendingTask = null;
    pendingTaskName = null;
    nativeResolve(details.proxy);
  }
  p.reject = () => {
    state = 'rejected';
    pendingTask = null;
    pendingTaskName = null;
    nativeReject(new DOMException("The user aborted a request", "AbortError"));
  }
  p.cancelTask = () => {
    pendingTask = null;
  }
  p.queueTask = (task, name) => {
    pendingTask = task;
    pendingTaskName = name;
  }
  p.state = () => {
    return state;
  }
  p.taskName = () => {
    return pendingTaskName;
  }

  const runOrRequeueTask = () => {
    if (!pendingTask)
      return;

    if (details.timeline.currentTime !== null) {
      pendingTask();
      pendingTask = null;
      return;
    }
    requestAnimationFrame(runOrRequeueTask);
  }

  // Run the pending task in the next animation frame. The task is responsible
  // for resolving the promise. The pending task will not run while the timeline
  // is inactive.
  requestAnimationFrame(runOrRequeueTask);

  details.readyPromise = p;
  return p;
}

function pendingPlay(details) {
  if (!details.readyPromise)
    return false;
  return details.readyPromise.taskName() == 'play';
}

function pendingPause(details) {
  if (!details.readyPromise)
    return false;
  return details.readyPromise.taskName() == 'pause';
}

/**
 * Creates a finished promise that can be synchronously resolved or scheduled to
 * resolve on the next animation frame after entering the finished state.
 */
function createFinishedPromise(details) {
  let nativeResolve = undefined;
  let nativeReject = undefined;
  let state = 'pending';
  const p = new Promise((resolve, reject) => {
    nativeResolve = resolve;
    nativeReject = reject;
  });
  p.resolve = () => {
    state = 'resolved';
    nativeResolve(details.proxy);
  }
  p.reject = () => {
    state = 'rejected';
    nativeReject(new DOMException("The user aborted a request", "AbortError"));
  }
  p.ScheduleAsyncFinish = () => {
    requestAnimationFrame(() => {
      // Ensure that we are still in the finished state as it may have been a
      // temporary state.
      if (details.proxy.playState == 'finished' && state == 'pending') {
         p.resolve();
         details.animation.finish();
      }
    });
  };
  details.finishedPromise = p;
  return p;
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

function calculateCurrentTime(details) {
  if (!details.timeline)
    return null;

  const timelineTime = details.timeline.curentTime;
  if (timelineTime === null)
    return null;

  if (details.startTime === null)
    return null;

  return (timelineTime - details.startTime) * details.animation.playbackRate;
}

function calculateStartTime(details, currentTime) {
  if (!details.timeline)
    return null;

  const timelineTime = details.timeline.currentTime;
  if (timelineTime == null)
    return null;

  return timelineTime - currentTime / details.animation.playbackRate;
}

function updateFinishedState(details, didSeek, synchronouslyNotify) {
  if (!details.timeline)
    return;

  // 1. Calculate the unconstrained current time. The dependency on did_seek is
  // required to accommodate timelines that may change direction. Without this
  // distinction, a once-finished animation would remain finished even when its
  // timeline progresses in the opposite direction.
  const unconstrainedCurrentTime =
      didSeek ? details.proxy.currentTime : calculateCurrentTime(details);

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
    const effectEnd = details.animation.effect.getTiming().duration;
    let boundary = details.previousCurrentTime;
    // TODO: Support hold phase.
    if (playbackRate > 0 && unconstrainedCurrentTime >= effectEnd) {
      if (boundary === null || boundary < effectEnd)
        boundary = effectEnd;
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
  details.previousCurrentTime = details.animation.currentTime;

  // 4. Set the current finished state.
  const playState = this.playState;
  if (playState == 'finished') {
    if (!details.finishedPromise)
      createFinishedPromise(details);

    if (details.finishedPromise.state() == 'pending') {
      // 5. Setup finished notification.
      if (synchronouslyNotify) {
        details.resolve();
        details.animation.finish();
      } else {
        details.finishdPromise.ScheduleAsyncFinish();
      }
    }
  } else {
    // 6. If not finished but the current finished promise is already resolved,
    //    create a new promise.
    if (details.finishedPromise &&
        details.finishedPromise.state() == 'resolved') {
      details.finsihedPromise = null;
    }
    if (details.animation.playState != 'paused')
      details.animation.pause();
  }
}

function hasActiveTimeline(details) {
  return !details.timeline || details.timeline.phase != 'inactive';
}

function syncCurrentTime(details) {
  if (!details.timeline)
    return;

  if (details.startTime !== null) {
    const timelineTime = details.timeline.currentTime;
    details.animation.currentTime =
        (timelineTime - details.startTime) * details.animation.playbackRate;
  } else if (details.holdTime !== null) {
    details.animation.currentTime = details.holdTime;
  }
}

function resetPendingTasks(details) {
  // https://www.w3.org/TR/web-animations-1/#reset-an-animations-pending-tasks

  // 1. If animation does not have a pending play task or a pending pause task,
  //    abort this procedure.
  if (!details.readyPromise || !details.readyPromise.state() == 'pending')
    return;

  // 2. If animation has a pending play task, cancel that task.
  // 3. If animation has a pending pause task, cancel that task.
  details.readyPromise.cancelTask();

  // 4. Apply any pending playback rate on animation.
  applyPendingPlaybackRate(details);

  // 5. Reject animation’s current ready promise with a DOMException named
  //    "AbortError".
  details.readyPromise.reject();

  // 6. Let animation’s current ready promise be the result of creating a new
  //    resolved Promise object.
  details.readyPromise = null;
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
    updateFinishedState(details, false, false);
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
      finishedPromise: null,
      // Start and hold times are directly tracked in the proxy despite being
      // accessible via the animation so that direct manipulation of these
      // properties does not affect the play state of the underlying animation.
      // Note that any changes to these values require an update of current
      // time for the underlying animation to ensure that its hold time is set
      // to the correct position.
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
          details.holdTime = null;
          details.startTime = null;
          break;

        case 'paused':
          details.resetCurrentTimeOnResume = true;
          details.animation.currentTime = previousCurrentTime;
          removeAnimation(details.timeline, details.animation);
          break;

        case 'running':
        case 'finished':
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
        createReadyPromise(details); // TODO: Need to queue up a task.
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
    } else {
      if (timelineTime !== null) {
        details.animation.currentTime =
            (timelineTime - value) * this.playbackRate;
        updateFinishedState(details, true, false);
      }
    }

    // Ensure that currentTime is updated for the native animation.
    syncCurrentTime(details);
  }

  get currentTime() {
    const details = proxyAnimations.get(this);
    if (!details.timeline)
      return details.animation.currentTime;

    if (details.holdTime != null)
      return details.holdTime;

    return calculateCurrentTime(details);
  }
  set currentTime(value) {
    const details = proxyAnimations.get(this);
    details.animation.currentTime = value;
    if (!details.timeline || value == null)
      return;

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
    if (pendingPause(details)) {
      details.holdTime = value;
      applyPendingPlaybackRate(details);
      details.startTime = null;
      details.readyPromise.cancelTask();
      details.readyPromise.resolve();
    }

    // Update the finished state.
    updateFinishedState(details, true, false);
  }

  get playbackRate() {
    return proxyAnimations.get(this).animation.playbackRate;
  }
  set playbackRate(value) {
    const details = proxyAnimations.get(this);
    details.animation.playbackRate = value;
    details.pendingPlaybackRate = null;
    updateFinishedState(details, false, false);
  }

  get playState() {
    details = proxyAnimations.get(this);
    if (!details.timeline)
      return details.animation.playState;

    const currentTime = this.currentTime;
    const pendingTask =
        details.readyPromise ? details.readyPromise.taskName() : null;

    // 1. All of the following conditions are true:
    //    * The current time of animation is unresolved, and
    //    * the start time of animation is unresolved, and
    //    * animation does not have either a pending play task or a pending pause
    //      task,
    //    then idle.
    if (currentTime === null && details.startTime === null &&
        pendingTask == null)
      return 'idle';

    // 2. Either of the following conditions are true:
    //    * animation has a pending pause task, or
    //    * both the start time of animation is unresolved and it does not have a
    //      pending play task,
    //    then paused.
    if (pendingTask == 'pause' ||
        (details.startTime === null && pendingTask == 'play'))
      return 'paused';

    // 3.  For animation, current time is resolved and either of the following
    //     conditions are true:
    //     * animation’s effective playback rate > 0 and current time >= target
    //       effect end; or
    //     * animation’s effective playback rate < 0 and current time <= 0,
    //    then finished.
    if (currentTime != null) {
      if (details.animation.playbackRate > 0 &&
          currentTime >= details.animation.effect.getTiming().duration)
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
    if (details.timeline)
      return details.readyPromise && details.readyPromise.state() == 'pending';

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
    const duration = details.animation.effect.getTiming().duration;
    if (playbackRate == 0 || (playbackRate < 0 && duration == Infinity)) {
      // Let native implementation handle throwing the exception. This should
      // not affect the state of the native animation.
      details.animation.finish();
      return;
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
    this.currentTime = limit;

    // 5. If animation’s start time is unresolved and animation has an
    //    associated active timeline, let the start time be the result of
    //    evaluating
    //        timeline time - (limit / playback rate)
    //    where timeline time is the current time value of the associated
    //    timeline.
    const timelineTime = details.timeline.currentTime;
    if (details.startTime === null && timelineTime !== null) {
       details.startTime =
           timelineTime - (limit / details.animation.playbackRate);
    }

    // 6. If there is a pending pause task and start time is resolved,
    //    6.1 Let the hold time be unresolved.
    //    6.2 Cancel the pending pause task.
    //    6.3 Resolve the current ready promise of animation with animation.
    if (pendingPause(details) && details.startTime !== null) {
      details.holdTime = null;
      details.readyPromise.cancelTask();
      details.readyPromise.resolve();
    }

    // 7. If there is a pending play task and start time is resolved, cancel
    //    that task and resolve the current ready promise of animation with
    //    animation.
    if (pendingPlay(details) && details.startTime !== null) {
      details.readyPromise.cancelTask();
      details.readyPromise.resolve();
    }

    // 8. Run the procedure to update an animation’s finished state for
    //    animation with the did seek flag set to true, and the synchronously
    //    notify flag set to true.
    updateFinishedState(details, true, true);

    // // Additional step to update the play state.
    // // TODO: Calculate the play state rather than storing it to better align
    // //       with the spec.
    // const currentTime = this.currentTime;
    // if (currentTime) {
    //   details.holdTime = currentTime;
    //   details.playState =
    //       (details.startTime != null) ? 'finished' : 'paused';
    // } else {
    //   if (details.startTime != null || details.holdTime != null) {
    //     details.playState = 'paused';
    //   } else {
    //     details.playState = 'idle';
    //   }
    // }
    // syncCurrentTime(details);
    // details.animation.finish();
  }

    // if (hasActiveTimeline(details)) {
    //   details.startTime = timelineTime - seekTime / playbackRate;
    //   details.holdTime = seekTime;
    //   details.playState = 'finished';
    //   removeAnimation(details.timeline, details.animation);
    //   if (details.readyPromise && details.readyPromise.state() == 'pending')
    //     details.readyPromise.resolve();
    // } else {
    //   details.startTime = null;
    //   details.holdTime = seekTime;
    //   details.playState = 'paused';
    // }
    // // Resolve the finished promise and fire the finished event.
    // details.animation.finish();
  // }

  play() {
    const details = proxyAnimations.get(this);
    if (!details.timeline) {
      details.animation.play();
      return;
    }

    // https://drafts.csswg.org/web-animations/#playing-an-animation-section.
    // 1. Let aborted pause be a boolean flag that is true if animation has a
    //    pending pause task, and false otherwise.
    // 2. Let has pending ready promise be a boolean flag that is initially
    //    false.
    // 3. Let seek time be a time value that is initially unresolved.
    // 4. Let has finite timeline be true if animation has an associated
    //    timeline that is not monotonically increasing.
    //    Note: this value will always true at this point in the polyfill.
    //    Following steps are pruned based on the procedure for scroll
    //    timelines.
    const abortedPause = details.playState == 'paused' && this.pending;

    let hasPendingReadyPromise = false;
    let seekTime = null;

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
    // Note: the auto-rewind flag is always true if directly calling play.

    let previousCurrentTime = details.animation.currentTime;

    // Resume of a paused animation after a timeline change snaps to the scroll
    // position.
    if (details.resetCurrentTimeOnResume) {
      previousCurrentTime = null;
      details.resetCurrentTimeOnResume = false;
    }

    const playbackRate = effectivePlaybackRate(details);
    const duration = details.animation.effect.getTiming().duration;
    if (playbackRate > 0 && (previousCurrentTime == null ||
                             previousCurrentTime < 0 ||
                             previousCurrentTime >= duration)) {
      seekTime = 0;
    } else if (playbackRate < 0 && (previousCurrentTime == null ||
                                    previousCurrentTime <= 0 ||
                                    previousCurrentTime > duration)) {
      if (duration == Infinity) {
        // Defer to native implementation to handle throwing the exception.
        details.animation.play();
        return;
      }
      seekTime = duration;
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

    // Additional steps for the polyfill.
    details.playState = "running";
    addAnimation(details.timeline, details.animation,
                 tickAnimation.bind(this));

    // 7. If animation's hold time is resolved, let its start time be
    //    unresolved.
    if (details.holdTime) {
      details.startTime = null;
    }

    // 8. If animation has a pending play task or a pending pause task,
    //   8.1 Cancel that task.
    //   8.2 Set has pending ready promise to true.
    if (details.readyPromise && this.pending) {
      details.readyPromise.cancelTask();
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
    const commitPendingPlay = () => {
      const timelineTime = details.timeline.currentTime;
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
        if (playbackRate == 0) {
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
      if (details.readyPromise && details.readyPromise.state() == 'pending')
         details.readyPromise.resolve();

      // 8.5 Run the procedure to update an animation’s finished state for
      //     animation with the did seek flag set to false, and the
      //     synchronously notify flag set to false.
      updateFinishedState(details, false, false);

      // Additional polyfill step to update the native animation's current time.
      syncCurrentTime(details);
    };

    if (!details.readyPromise)
      createReadyPromise(details);
    details.readyPromise.queueTask(commitPendingPlay, 'play');
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
    if (details.playState == "paused")
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
    const duration = details.animation.effect.getTiming().duration;

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
    if (details.playState == 'running' && details.readyPromise &&
        details.readyPromise.state() == 'pending') {
      details.readyPromise.cancelTask();
    } else {
      details.readyPromise = null;
    }

    // Extra step for the polyfill.
    details.playState = 'paused';

    // 10. Schedule a task to be executed at the first possible moment after the
    //     user agent has performed any processing necessary to suspend the
    //     playback of animation’s target effect, if any. The task shall perform
    //     the following steps:
    const commitPendingPause = () => {
      // 1. Let ready time be the time value of the timeline associated with
      //    animation at the moment when the user agent completed processing
      //    necessary to suspend playback of animation’s target effect.
      const readyTime = details.timeline.currentTime;

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
      details.readyPromise.resolve();

      // 6. Run the procedure to update an animation’s finished state for
      // animation with the did seek flag set to false, and the synchronously
      //  notify flag set to false.
      updateFinishedState(details, false, false);

      // Additional polyfill step to update the native animation's current time.
      syncCurrentTime(details);
    };

    if (!details.readyPromise)
      createReadyPromise(details);
    details.readyPromise.queueTask(commitPendingPause, 'pause');
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

    // https://drafts.csswg.org/web-animations/#setting-the-playback-rate-of-an-animation

    // 1. Let previous play state be animation’s play state.
    // 2. Let animation’s pending playback rate be new playback rate.
    const previousPlayState = details.playState;

    // 3. Perform the steps corresponding to the first matching condition from
    //    below:
    //
    // 3a If animation has a pending play task or a pending pause task,
    //    Abort these steps.
    if (details.readyPromise && details.readyPromise.state() == 'pending')
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
        const timelineTime = details.timeline.currentTime;
        const unconstrainedCurrentTime = timelineTime !== null ?
            (timelineTime - details.startTime) * details.animation.playbackRate
            : null;
        if (value == 0) {
          details.startTime = timelineTime;
        } else {
          details.startTime =
              timelineTime != null && unconstrainedCurrentTime != null ?
                  (timelineTime - unconstrainedCurrentTime) / value : null;
        }
        applyPendingPlaybackRate(details);
        updateFinishedState(details, false, false);
        syncCurrentTime(details);
        break;

      // 3d Otherwise,
      // Run the procedure to play an animation for animation with the
      // auto-rewind flag set to false.
      default:
        this.play();
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
    //    1.2+ Handled by native implementation.
    if (details.playState == 'idle')
      return;
    resetPendingTasks(details);
    details.animation.cancel();

    // 2. Make animation’s hold time unresolved.
    // 3. Make animation’s start time unresolved.
    details.startTime = null;
    details.holdTime = null;
    // details.playState = 'idle';

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
      createFinishedPromise(details);
      if (this.playState == 'finished')
        details.finishedPromsie.resolve();
    }
    return details.finishedPromise;
  }

  get ready() {
    const details = proxyAnimations.get(this);
    if (!details.timeline)
      return details.animation.ready;

    if (!details.readyPromise) {
      createReadyPromise(details);
      details.readyPromise.resolve();
    }
    return details.readyPromise;
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
