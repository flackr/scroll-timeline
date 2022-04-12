import { StyleParser, removeKeywordsFromAnimationShorthand } from "./scroll-timeline-css-parser";

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

    // TODO: Not a good idea to proxy all elements.
    // Not adding proxy affects tests that there is no animation,
    // but there is change for 'animation', 'animation-timeline', etc via style
    // like this: e.style['animation-timeline'] = "none, auto"
    // document.querySelectorAll("body *").forEach(element => {
    //   addProxyForElement(element);
    // });
  });

  sheetObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  function handleStyleTag(el) { // el: HtmlStyleElement
    // Don’t touch empty style tags.
    if (el.innerHTML.trim().length === 0) {
      return;
    }
    const newSrc = parser.transpileStyleSheet(el.innerHTML);
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

function getSourceElement(source) {
  const matches = /selector\(#([^)]+)\)/.exec(source);
  if (matches) {
    return document.getElementById(matches[1]);
  } else if (source === "auto") {
    return document.scrollingElement;
  } else {
    return null;
  }
}

function convertOneScrollOffset(part) {
  if (part == 'auto') return new CSSKeywordValue('auto');

  const validScrollOffsetSuffixes = [
    // Relative lengths.
    'em',
    'ex',
    'ch',
    'rem',
    'vw',
    'vh',
    'vmin',
    'vmax',
    // Absolute lengths.
    'cm',
    'mm',
    'q',
    'in',
    'pc',
    'pt',
    'px',
    // Percentage.
    '%',
  ];

  const offsetWithSuffix = new RegExp('(^[0-9]+)(' + validScrollOffsetSuffixes.join('|') + ')');
  const matchesOffsetWithSuffix = offsetWithSuffix.exec(part);
  if (matchesOffsetWithSuffix) {
    return new CSSUnitValue(parseInt(matchesOffsetWithSuffix[1]), matchesOffsetWithSuffix[2]);
  }

  const matchesSelector = /selector\(#([^)]+)\)[ ]{0,1}(start|end)*[ ]{0,1}([0-9]+[.]{0,1}[0-9]*)*/.exec(part);
  if (matchesSelector) {
    if (document.getElementById(matchesSelector[1])) {
      return {
        target: document.getElementById(matchesSelector[1]),
        ...(matchesSelector.length >= 3 ? { edge: matchesSelector[2] } : {}),
        ...(matchesSelector.length >= 4 ? { threshold: parseFloat(matchesSelector[3]) } : {})
      };
    }
  }

  return null;
}

function isDescendant(child, parent) {
  while (child) {
    if (child == parent) return true;
    child = child.parentNode;
  }
  return false;
}

function getScrollOffsets(source, offsets) {
  let scrollOffsets = undefined;

  if (offsets) {
    if (offsets == "none") {
      // do nothing
    } else {
      scrollOffsets = offsets.split(",")
        .map(part => part.trim())
        .filter(part => part != '')
        .map(part => convertOneScrollOffset(part))
        .filter(offset => offset);

      // If the available scroll-offsets are not valid,
      // so we won't create the scrollTimeline,
      for (let off of scrollOffsets) {
        if (off.target && off.target instanceof Element &&
          (window.getComputedStyle(off.target, null).display == "none" || !isDescendant(off.target, source))) {
          return null;
        }
      }
      if (scrollOffsets.length == 0) {
        return null;
      }
    }
  }

  return scrollOffsets;
}

function createScrollTimeline(name) {
  const options = parser.scrollTimelineOptions.get(name);
  if (!options) return null;

  const sourceElement = getSourceElement(options.source);
  const scrollOffsets = getScrollOffsets(sourceElement, options['scroll-offsets']);

  if (scrollOffsets !== null) {
    const scrollTimeline = new ScrollTimeline({
      ...(sourceElement ? { source: getSourceElement(options.source) } : {}),
      ...(scrollOffsets ? { scrollOffsets: scrollOffsets } : {}),
      ...(options.orientation != "auto" ? { orientation: options.orientation } : {}),
    });
    return scrollTimeline;
  } else {
    return null;
  }
}

export function initCSSPolyfill() {
  initMutationObserver();

  window.addEventListener('animationstart', (evt) => {
    evt.target.getAnimations().filter(anim => anim.animationName === evt.animationName).forEach(anim => {
      const timelineName = parser.getScrollTimelineName(anim.animationName, evt.target);
      if (timelineName) {
        const scrollTimeline = createScrollTimeline(timelineName);
        // If there is a scrollTimeline name associated to this animation,
        // cancel it, whether we create a new animation or not
        // depends on the fact that whether that scrollTimeline was valid or not
        anim.cancel();
        if (scrollTimeline) {
          if (anim.timeline != scrollTimeline) {
            const target = anim.effect.target;
            const keyframes = anim.effect.getKeyframes();
            target.animate(keyframes, { timeline: scrollTimeline });
          }
        } else {
          // animation-timeline:none, or unknown timeline
          // or invalid scroll-offsets
        }
      }
    });
  });
}
