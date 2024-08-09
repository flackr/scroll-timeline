import { StyleParser } from "./scroll-timeline-css-parser";
import { ProxyAnimation } from "./proxy-animation"
import { ScrollTimeline, ViewTimeline, getScrollParent, calculateRange,
  calculateRelativePosition, measureSubject, measureSource } from "./scroll-timeline-base";

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
    // Don’t touch empty style tags nor tags controlled by aphrodite.
    // Details at https://github.com/Khan/aphrodite/blob/master/src/inject.js,
    // but any modification to the style tag will break the entire page.
    if (el.innerHTML.trim().length === 0 || 'aphrodite' in el.dataset) {
      return;
    }
    // TODO: Do with one pass for better performance
    let newSrc = parser.transpileStyleSheet(el.innerHTML, true);
    newSrc = parser.transpileStyleSheet(newSrc, false);
    el.innerHTML = newSrc;
  }

  function handleLinkedStylesheet(linkElement) {
    // Filter only css links to external stylesheets.
    if (linkElement.type != 'text/css' && linkElement.rel != 'stylesheet' || !linkElement.href) {
      return;
    }
    const url = new URL(linkElement.href, document.baseURI);
    if (url.origin != location.origin) {
      // Most likely we won't be able to fetch resources from other origins.
      return;
    }
    fetch(linkElement.getAttribute('href')).then(async (response) => {
      const result = await response.text();
      let newSrc = parser.transpileStyleSheet(result, true);
      newSrc = parser.transpileStyleSheet(result, false, response.url);
      if (newSrc != result) {
        const blob = new Blob([newSrc], { type: 'text/css' });
        const url = URL.createObjectURL(blob);
        linkElement.setAttribute('href', url);
      }
    });
  }

  document.querySelectorAll("style").forEach((tag) => handleStyleTag(tag));
  document
    .querySelectorAll("link")
    .forEach((tag) => handleLinkedStylesheet(tag));
}

function relativePosition(phase, container, target, axis, optionsInset, percent) {
  const sourceMeasurements = measureSource(container)
  const subjectMeasurements = measureSubject(container, target)
  const phaseRange = calculateRange(phase, sourceMeasurements, subjectMeasurements, axis, optionsInset);
  const coverRange = calculateRange('cover', sourceMeasurements, subjectMeasurements, axis, optionsInset);
  return calculateRelativePosition(phaseRange, percent, coverRange, target);
}

function createScrollTimeline(anim, animationName, target) {
  const animOptions = parser.getAnimationTimelineOptions(animationName, target);

  if(!animOptions)
    return null;

  const timelineName = animOptions['animation-timeline'];
  if(!timelineName) return null;

  let options = parser.getScrollTimelineOptions(timelineName, target) ||
    parser.getViewTimelineOptions(timelineName, target);
  if (!options) return null;

  // If this is a ViewTimeline
  if(options.subject)
    updateKeyframesIfNecessary(anim, options);

  return {
    timeline: options.source ? new ScrollTimeline(options) : new ViewTimeline(options),
    animOptions: animOptions
  };
}

function updateKeyframesIfNecessary(anim, options) {
  const container = getScrollParent(options.subject);
  const axis = (options.axis || options.axis);

  function calculateNewOffset(mapping, keyframe) {
    let newOffset = null;
    for(const [key, value] of mapping) {
      if(key == keyframe.offset * 100) {
        if(value == 'from') {
          newOffset = 0;
        } else if(value == 'to') {
          newOffset = 100;
        } else {
          const tokens = value.split(" ");
          if(tokens.length == 1) {
            newOffset = parseFloat(tokens[0]);
          } else {
            newOffset = relativePosition(tokens[0], container, options.subject,
              axis, options.inset, CSS.percent(parseFloat(tokens[1]))) * 100;
          }
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
  }
}

export function initCSSPolyfill() {
  // Don't load if browser claims support
  if (CSS.supports("animation-timeline: --works")) {
    return true;
  }

  initMutationObserver();

  // Override CSS.supports() to claim support for the CSS properties from now on
  const oldSupports = CSS.supports;
  CSS.supports = (ident) => {
    ident = ident.replaceAll(/(animation-timeline|scroll-timeline(-(name|axis))?|view-timeline(-(name|axis|inset))?|timeline-scope)\s*:/g, '--supported-property:');
    return oldSupports(ident);
  };

  // We are not wrapping capturing 'animationstart' by a 'load' event,
  // because we may lose some of the 'animationstart' events by the time 'load' is completed.
  window.addEventListener('animationstart', (evt) => {
    evt.target.getAnimations().filter(anim => anim.animationName === evt.animationName).forEach(anim => {
      const result = createScrollTimeline(anim, anim.animationName, evt.target);
      if (result) {
        // If the CSS Animation refers to a scroll or view timeline we need to proxy the animation instance.
        if (result.timeline && !(anim instanceof ProxyAnimation)) {
          const proxyAnimation = new ProxyAnimation(anim, result.timeline, result.animOptions);
          anim.pause();
          proxyAnimation.play();
        } else {
          // If the timeline was removed or the animation was already an instance of a proxy animation,
          // invoke the set the timeline procedure on the existing animation.
          anim.timeline = result.timeline;
        }
      }
    });
  });
}
