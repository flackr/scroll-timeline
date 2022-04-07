import { StyleParser, removeKeywordsFromAnimationShorthand } from "./scroll-timeline-css-parser";

const parser = new StyleParser();

function initMutationobserver() {
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

    // TODO: not a good idea to proxy all elements,
    // this affects tests that there is no animation, 
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

      // there are some offsets, but they are not valid
      // so we just don't create the scrollTimeline
      // this way, the name of the scrollTimline is there,
      // but there is no object for that
      for (off of scrollOffsets) {
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

function addProxyForElement(elem) {
  const styleHandler = {
    get(target, prop, receiver) {
      if (prop === 'getPropertyValue') {
        return (prop) => {
          if (prop === 'animation' && target['animation-timeline']) {
            return `${target[prop]} ${target['animation-timeline']}`;
          }

          return target[prop];
        };
      }

      if (prop in target) {
        return target[prop];
      }

      return Reflect.get(...arguments);
    },
    set(obj, prop, value) {
      if (prop == 'animation') {
        let animationTimelines = [];
        const animations = value.split(',')
          .map(anim => anim.trim())
          .map(anim => {
            const remainingTokens = removeKeywordsFromAnimationShorthand(anim);

            // if after removing keywords and times and numbers,
            // there are two tokens remaining, we are assuming the
            // first part is animation-name and the second part
            // is animation-timeline!
            if (remainingTokens.length == 2) {
              animationTimelines.push(remainingTokens[1]);
              return anim.split(' ').slice(0, -1).join(' ');
            } else {
              return anim;
            }
          }).join(', ');

        if (animationTimelines.length > 0) {
          obj['animation-timeline'] = animationTimelines.join(", ");
        }
        obj[prop] = animations;
        return Reflect.set(obj, prop, animations);
      }

      // TODO: split value when prop=='animation-timeline'
      if (prop == 'animation-timeline') {
        obj[prop] = value;
        return true;
      }

      return Reflect.set(...arguments);
    },
  };

  const handler = {
    get(target, prop, receiver) {
      let result = Reflect.get(...arguments);
      if (prop === 'style') {
        return new Proxy(result, styleHandler);
      }
      return result;
    },
  };
  elem.__proto__ = new Proxy(Object.getPrototypeOf(elem), handler);
}

function getScrollTimelineName(animationName, target) {
  let targetTimeline = parser.animationToScrollTimeline.get(animationName);
  if (targetTimeline) return targetTimeline;

  parser.scrollTimelineCSSRules.forEach((rule, timeline) => {
    document.querySelectorAll(rule).forEach(element => {
      if (element == target) {
        targetTimeline = timeline;
      }
    })
  })
  return targetTimeline;
}

export function initCSSPolyfill() {
  initMutationobserver();

  window.addEventListener('animationstart', (evt) => {
    const anim =
      evt.target.getAnimations().filter(
        anim => anim.animationName == evt.animationName)[0];

    const scrollTimelineName = getScrollTimelineName(anim.animationName, evt.target);

    if (scrollTimelineName) {
      const scrollTimeline = createScrollTimeline(scrollTimelineName);
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
        // anim.cancel();
      }
    }
  });
}
