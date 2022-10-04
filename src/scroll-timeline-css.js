import { StyleParser, RegexMatcher } from "./scroll-timeline-css-parser";
import { ProxyAnimation } from "./proxy-animation"
import { ScrollTimeline, ViewTimeline, getScrollParent, calculateRange,
  calculateRelativePosition } from "./scroll-timeline-base";

const parser = new StyleParser();

function initMutationObserver() {
  const sheetObserver = new MutationObserver((entries) => {
    for (const entry of entries) {
      for (const addedNode of entry.addedNodes) {
        if (addedNode instanceof HTMLStyleElement) {
          handleStyleTag(addedNode);
        }
        if (addedNode instanceof HTMLLinkElement) {
          handleLinkedStylesheet(addedNode);
        }
      }
    }

    // TODO: Proxy element.style similar to how we proxy element.animate.
    // We accomplish this by swapping out Element.prototype.style.
  });

  sheetObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  /**
   * @param {HtmlStyleElement} el style tag to be parsed
   */
  function handleStyleTag(el) {
    // Don’t touch empty style tags.
    if (el.innerHTML.trim().length === 0) {
      return;
    }
    // TODO: Do with one pass for better performance
    let newSrc = parser.transpileStyleSheet(el.innerHTML, true);
    newSrc = parser.transpileStyleSheet(newSrc, false);
    el.innerHTML = newSrc;
  }

  function handleLinkedStylesheet(el) {
    // TODO
  }

  document.querySelectorAll("style").forEach((tag) => handleStyleTag(tag));
  document
    .querySelectorAll("link")
    .forEach((tag) => handleLinkedStylesheet(tag));
}

function relativePosition(phase, container, target, orientation, optionsInset, percent) {
  const phaseRange = calculateRange(phase, container, target, orientation, optionsInset);
  const coverRange = calculateRange('cover', container, target, orientation, optionsInset);
  return calculateRelativePosition(phaseRange, percent, coverRange);
}

function isDescendant(child, parent) {
  while (child) {
    if (child == parent) return true;
    child = child.parentNode;
  }
  return false;
}

function createScrollTimeline(anim, animationName, target) {
  const animOptions = parser.getAnimationTimelineOptions(animationName, target);
  const timelineName = animOptions['animation-timeline'];
  if(!timelineName) return null;

  let options = parser.getScrollTimelineOptions(timelineName) ||
    parser.getViewTimelineOptions(timelineName, target);
  if (!options) return null;

  const container = getScrollParent(options.subject);
  const orientation = (options.axis || options.orientation);

  function calculateNewOffset(mapping, keyframe) {
    let newOffset = null;
    for(const [key, value] of mapping) {
      if(parseFloat(key) == keyframe.offset * 100) {
        if(value == 'from') {
          newOffset = 0;
        } else if(value == 'to') {
          newOffset = 100;
        } else {
          const tokens = value.split(" ");
          if(tokens.length == 1)
            newOffset = parseFloat(tokens[0]);
          else
            newOffset = Math.round(relativePosition(tokens[0], container, options.subject, orientation, options.inset, CSS.percent(parseFloat(tokens[1]))) * 100);
        }
        break;
      }
    }

    return newOffset;
  }

  const mapping = parser.keyframeNamesSelectors.get(anim.animationName);
  // mapping is empty when none of the keyframe selectors contains a phase
  if(mapping && mapping.size) {
    const newKeyframes = [];
    anim.effect.getKeyframes().forEach(keyframe => {
      const newOffset = calculateNewOffset(mapping, keyframe);
      if(newOffset !== null && newOffset >= 0 && newOffset <= 100) {
        keyframe.offset = newOffset / 100.0;
        newKeyframes.push(keyframe);
      }
    });

    const sortedKeyframes = newKeyframes.sort((a, b) => {
      if(a.offset < b.offset) return -1;
      if(a.affset > b.offset) return 1;
      return 0;
    });

    anim.effect.setKeyframes(sortedKeyframes);
    // Since the mapping has been applied to these @keyframes, we no longer need them.
    parser.keyframeNamesSelectors.set(anim.animationName, null);
  }

  return {
    timeline: options.source ? new ScrollTimeline(options) : new ViewTimeline(options),
    animOptions: animOptions
  };
}

export function initCSSPolyfill() {
  // Don't load if browser claims support
  if (CSS.supports("animation-timeline: works")) {
    return;
  }

  initMutationObserver();

  // We are not wrapping capturing 'animationstart' by a 'load' event,
  // because we may lose some of the 'animationstart' events by the time 'load' is completed.
  window.addEventListener('animationstart', (evt) => {
    evt.target.getAnimations().filter(anim => anim.animationName === evt.animationName).forEach(anim => {
      const result = createScrollTimeline(anim, anim.animationName, evt.target);
      if (result.timeline && anim.timeline != result.timeline) {
        const proxyAnimation = new ProxyAnimation(anim, result.timeline, result.animOptions);
        anim.pause();
        proxyAnimation.play();
      }
    });
  });
}
