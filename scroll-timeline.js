(function(scope) {
  let scrollTimelineOptions = new WeakMap();

  function scrollEventSource(scrollSource) {
    if (scrollSource === document.scrollingElement)
      return document;
    return scrollSource;
  }

  function parseLength(str) {
    return str.match(/([0-9]*\.?[0-9]*)(px|%)/);
  }

  function calculateTargetEffectEnd(options) {
    if (options.iterationCount == Infinity)
      return Infinity;
    return Math.max((options.startDelay || 0) + (options.duration || 0) * (options.iterationCount || 1) + (options.endDelay || 0), 0);
  }

  function calculateScrollOffset(autoValue, scrollSource, orientation, offset) {
    if (orientation == 'block')
      orientation = 'vertical';
    else if (orientation == 'inline')
      orientation = 'horizontal';

    let maxValue = orientation == 'vertical' ?
        scrollSource.scrollHeight - scrollSource.clientHeight :
        scrollSource.scrollWidth - scrollSource.clientWidth;
    let parsed = parseLength(offset == 'auto' ? autoValue : offset);
    if (parsed[2] == '%')
      return parseFloat(parsed[1]) * maxValue / 100;
    return parseFloat(parsed[1]);
  }

  function calculateTimeRange(scrollTimeline) {
    let timeRange = scrollTimeline.timeRange;
    if (timeRange == 'auto') {
      timeRange = 0;
      let options = scrollTimelineOptions.get(scrollTimeline).animationOptions;
      for (let i = 0; i < options.length; i++) {
        timeRange = Math.max(timeRange, calculateTargetEffectEnd(options[i]));
      }
      if (timeRange == Infinity)
        timeRange = 0;
    }
    return timeRange;
  }

  function updateInternal() {
    let animations = scrollTimelineOptions.get(this).animations;
    if (animations.length == 0)
      return;
    let currentTime = this.currentTime;
    for (let i = 0; i < animations.length; i++) {
      animations[i].currentTime = currentTime;
    }
  }

  function addAnimation(scrollTimeline, animation, options) {
    let animations = scrollTimelineOptions.get(scrollTimeline).animations;
    let animationOptions = scrollTimelineOptions.get(scrollTimeline).animationOptions;
    animations.push(animation);
    animationOptions.push(options);
    updateInternal.apply(scrollTimeline);
  }

  function removeAnimation(scrollTimeline, animation) {
    let animations = scrollTimelineOptions.get(scrollTimeline).animations;
    let index = animations.indexOf(animation);
    if (index == -1)
      return;
    animations.splice(index, 1);
    scrollTimelineOptions.get(scrollTimeline).animationOptions.splice(index, 1);
  }

  class ScrollTimeline {
    constructor(options) {
      scrollTimelineOptions.set(this, {
        scrollSource: null,
        orientation: 'block',
        startScrollOffset: 'auto',
        endScrollOffset: 'auto',
        timeRange: 'auto',
        fill: 'none',

        // Internal members
        animations: [],
        animationOptions: [],
        updateFunction: updateInternal.bind(this),
      });
      this.scrollSource = options && options.scrollSource || document.scrollingElement;
      this.orientation = options && options.orientation || 'block';
      this.startScrollOffset = options && options.startScrollOffset || 'auto';
      this.endScrollOffset = options && options.endScrollOffset || 'auto';
      this.timeRange = options && options.timeRange || 'auto';
      this.fill = options && options.fill || 'none';
    }

    set scrollSource(element) {
      let internal = scrollTimelineOptions.get(this);
      if (this.scrollSource)
        scrollEventSource(this.scrollSource).removeEventListener('scroll', internal.updateFunction);
      if (!(element instanceof Element))
        element = document.scrollingElement;
      scrollTimelineOptions.get(this).scrollSource = element;
      scrollEventSource(element).addEventListener('scroll', internal.updateFunction);
      updateInternal.apply(this);
    }

    get scrollSource() {
      return scrollTimelineOptions.get(this).scrollSource;
    }

    set orientation(orientation) {
      if (['block', 'inline', 'horizontal', 'vertical'].indexOf(orientation) == -1)
        orientation = 'block';
      scrollTimelineOptions.get(this).orientation = orientation;
      updateInternal.apply(this);
    }

    get orientation() {
      return scrollTimelineOptions.get(this).orientation;
    }

    set startScrollOffset(offset) {
      scrollTimelineOptions.get(this).startScrollOffset = offset;
      updateInternal.apply(this);
    }

    get startScrollOffset() {
      return scrollTimelineOptions.get(this).startScrollOffset;
    }

    set endScrollOffset(offset) {
      scrollTimelineOptions.get(this).endScrollOffset = offset;
      updateInternal.apply(this);
    }

    get endScrollOffset() {
      return scrollTimelineOptions.get(this).endScrollOffset;
    }

    set timeRange(offset) {
      scrollTimelineOptions.get(this).timeRange = offset;
      updateInternal.apply(this);
    }

    get timeRange() {
      return scrollTimelineOptions.get(this).timeRange;
    }

    get currentTime() {
      let startOffset = calculateScrollOffset('0%', this.scrollSource, this.orientation, this.startScrollOffset);
      let endOffset = calculateScrollOffset('100%', this.scrollSource, this.orientation, this.endScrollOffset);
      let position = this.scrollSource.scrollTop;
      let timeRange = calculateTimeRange(this);
      return (position - startOffset) / (endOffset - startOffset) * timeRange;
    }
  };

  scope.ScrollTimeline = ScrollTimeline;
  let nativeAnimate = scope.Element.prototype.animate;
  scope.Element.prototype.animate = function(keyframes, options) {
    let timeline = options.timeline;
    if (!timeline || !(timeline instanceof ScrollTimeline)) {
      return nativeAnimate.apply(this, arguments);
    }
    delete options.timeline;
    let animation = nativeAnimate.apply(this, arguments);
    // TODO: Create a proxy for the animation to control and fake the animation
    // play state.
    animation.pause();
    addAnimation(timeline, animation, options);
    return animation;
  };

})(self);
