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

function isDescendant(child, parent) {
  while (child) {
    if (child == parent) return true;
    child = child.parentNode;
  }
  return false;
}

function createScrollTimeline(animationName, target) {
  const animationOptions = parser.getAnimationTimelineOptions(animationName, target);
  const timelineName = animationOptions['animation-timeline'];
  if(!timelineName) return null;

  let options = parser.getScrollTimelineOptions(timelineName) ||
    parser.getViewTimelineOptions(timelineName, animationOptions);
  if (!options) return null;

  return options.source ? new ScrollTimeline(options) : new ViewTimeline(options);
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
      const scrollTimeline = createScrollTimeline(anim.animationName, evt.target);
      if (scrollTimeline && anim.timeline != scrollTimeline) {
        const proxyAnimation = new ProxyAnimation(anim, scrollTimeline);
        anim.pause();
        proxyAnimation.play();
      }
    });
  });
}
