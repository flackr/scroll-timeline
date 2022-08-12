import { StyleParser, RegexMatcher } from "./scroll-timeline-css-parser";
import { ProxyAnimation } from "./proxy-animation"
import { ScrollTimeline, ViewTimeline } from "./scroll-timeline-base";

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

// This implementation is based on https://drafts.csswg.org/scroll-animations-1/
// TODO: Should update accordingly when new spec lands.
function getSourceElement(source) {
  const matches = RegexMatcher.SOURCE_ELEMENT.exec(source);
  const SOURCE_CAPTURE_INDEX = 1;
  if (matches) {
    return document.getElementById(matches[SOURCE_CAPTURE_INDEX]);
  } else if (source === "auto") {
    return document.scrollingElement;
  } else {
    return null;
  }
}

function isDescendant(child, parent) {
  while (child) {
    if (child == parent) return true;
    child = child.parentNode;
  }
  return false;
}

function createScrollTimeline(name) {
  let options = parser.scrollTimelineOptions.get(name) ||
    parser.getViewTimelineOptions(name);
  if (!options) return null;

  if(options.source) {
    const sourceElement = getSourceElement(options.source);
    return new ScrollTimeline({
      ...(sourceElement ? { source: getSourceElement(options.source) } : {}),
      ...(options.orientation != "auto" ? { orientation: options.orientation } : {}),
    });
  } else {
    return new ViewTimeline({
      subject: document.querySelector(options.selector),
      axis: options.axis
    });
  }
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
      const timelineName = parser.getScrollTimelineName(anim.animationName, evt.target);
      if (timelineName) {
        const scrollTimeline = createScrollTimeline(timelineName);
        if (scrollTimeline && anim.timeline != scrollTimeline) {
          const proxyAnimation = new ProxyAnimation(anim, scrollTimeline);
          anim.pause();
          proxyAnimation.play();
        }
      }
    });
  });
}
