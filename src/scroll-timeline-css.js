function transpileStyleSheet(sheetSrc, srcUrl) {
  // AdhocParser
  const p = {
    sheetSrc: sheetSrc,
    index: 0,
    name: srcUrl,
  };

  while (p.index < p.sheetSrc.length) {
    eatWhitespace(p);
    if (p.index >= p.sheetSrc.length) break;
    if (lookAhead("/*", p)) {
      while (lookAhead("/*", p)) {
        eatComment(p);
        eatWhitespace(p);
      }
      continue;
    }
    if (lookAhead("@scroll-timeline", p)) {
      const { scrollTimeline, startIndex, endIndex } = parseScrollTimeline(p);
      // console.log("found @scroll-timeline " + JSON.stringify(scrollTimeline));

      saveScrollTimelineOptions(scrollTimeline.name, scrollTimeline);

      // // console.log("after " + JSON.stringify(scrollTimeline));

      // const replacement = stringifyContainerQuery(query); // todo
      // replacePart(startIndex, endIndex, p, p);
      // registerContainerQuery(query); // todo
    } else {
      const rule = parseQualifiedRule(p);
      if (!rule) continue;
      // // console.log("rule " + JSON.stringify(rule));
      handleScrollTimelineProps(rule, p);
    }
  }

  // If this sheet has no srcURL (like from a <style> tag), we are
  // done. Otherwise, we have to find `url()` functions and resolve
  // relative and path-absolute URLs to absolute URLs.
  if (!srcUrl) {
    return p.sheetSrc;
  }

  p.sheetSrc = p.sheetSrc.replace(
    /url\(["']*([^)"']+)["']*\)/g,
    (match, url) => {
      return `url(${new URL(url, srcUrl)})`;
    }
  );
  return p.sheetSrc;
}

function parseScrollTimeline(p) {
  const startIndex = p.index;
  assertString(p, "@scroll-timeline");
  eatWhitespace(p);
  let name = parseIdentifier(p);
  // console.log("name: " + name);
  eatWhitespace(p);
  assertString(p, "{"); // eats {
  eatWhitespace(p);

  let scrollTimeline = {
    name: name,
    source: "auto",
    orientation: undefined,
    scrollOffsets: []
  };

  while (peek(p) !== "}") {
    const temp = parseIdentifier(p);
    eatWhitespace(p);
    assertString(p, ":");
    eatWhitespace(p);
    scrollTimeline[temp] = removeEnclosingDoubleQuotes(eatUntil(";", p));
    assertString(p, ";");
    eatWhitespace(p);
  }

  // console.log("scrollTimeline.source >>" + scrollTimeline.source + "<<");
  // // console.log("scrollTimeline.orientation >>" + scrollTimeline.orientation + "<<");

  assertString(p, "}");
  const endIndex = p.index;
  eatWhitespace(p);
  return {
    scrollTimeline,
    startIndex,
    endIndex,
  };
}

const identMatcher = /[\w\\\@_-]+/g;
function parseIdentifier(p) {
  identMatcher.lastIndex = p.index;
  const match = identMatcher.exec(p.sheetSrc);
  if (!match) {
    throw parseError(p, "Expected an identifier");
  }
  p.index += match[0].length;
  return match[0];
}

function parseQualifiedRule(p) {
  const startIndex = p.index;
  const selector = parseSelector(p);
  if (!selector) return;
  const block = eatBlock(p);
  const endIndex = p.index;
  return {
    selector,
    block,
    startIndex,
    endIndex,
  };
}

function removeEnclosingDoubleQuotes(s) {
  let startIndex = s[0] == '"' ? 1 : 0;
  let endIndex = s[s.length - 1] == '"' ? s.length - 1 : s.length;
  return s.substring(startIndex, endIndex);
}

function assertString(p, s) {
  if (p.sheetSrc.substr(p.index, s.length) != s) {
    throw parseError(p, `Did not find expected sequence ${s}`);
  }
  p.index += s.length;
}

function handleScrollTimelineProps(rule, p) {
  // todo includes()? is this enough
  const hasAnimationName = rule.block.contents.includes("animation-name");
  const hasAnimation = rule.block.contents.includes("animation");
  const hasScrollTimeline = rule.block.contents.includes("animation-timeline");

  // if (!hasScrollTimeline) return;

  if (hasScrollTimeline && hasAnimationName) {
    let timelineNames = /animation-timeline\s*:([^;}]+)/
      .exec(rule.block.contents)?.[1]
      .trim().split(",").map(name => name.trim());

    let animationNames = /animation-name\s*:([^;}]+)/
      .exec(rule.block.contents)?.[1]
      .trim().split(",").map(name => name.trim());

    // assert(timelineNames.length == animationNames.length);

    for (let i = 0; i < timelineNames.length; i++) {
      animationToScrollTimeline.set(animationNames[i], timelineNames[i]);
      console.log("group " + animationNames[i] + " " + timelineNames[i]);
    }

    return;
  }

  let scrollTimelineName = /animation-timeline\s*:([^;}]+)/
    .exec(rule.block.contents)?.[1]
    .trim();

  let animationName = undefined;
  if (hasAnimationName) {
    animationName = /animation-name\s*:([^;}]+)/
      .exec(rule.block.contents)?.[1]
      .trim();
  } else if (hasAnimation) {
    let shorthand = /animation\s*:([^;}]+)/
      .exec(rule.block.contents)?.[1]
      .trim();

    if (shorthand) {
      let remainingTokens = removeKeywordsFromAnimationShorthand(shorthand);
      if (remainingTokens.length <= 2)
        animationName = remainingTokens[0];

      if (remainingTokens.length == 2) {
        scrollTimelineName = remainingTokens[1];

        rule.block.contents = rule.block.contents.replace(
          scrollTimelineName,
          ""
        );
        replacePart(
          rule.block.startIndex,
          rule.block.endIndex,
          rule.block.contents,
          p
        );
      }
    }
  }

  if (animationName && scrollTimelineName) {
    animationToScrollTimeline.set(animationName, scrollTimelineName);
  }

  // The animation-timeline property may not be used in keyframes
  if (scrollTimelineName && !rule.selector.includes("@keyframes")) {
    scrollTimelineCSSRules.set(scrollTimelineName, rule.selector.trim());
  }

  // todo
  // watchedContainerSelectors.push({
  //     name: containerName,
  //     selector: rule.selector,
  // });
  // for (const el of document.querySelectorAll(rule.selector)) {
  //     registerContainer(el, containerName);
  // }
}

function replacePart(start, end, replacement, p) {
  p.sheetSrc = p.sheetSrc.slice(0, start) + replacement + p.sheetSrc.slice(end);
  // If we are pointing past the end of the affected section, we need to
  // recalculate the string pointer. Pointing to something inside the section
  // that’s being replaced is undefined behavior. Sue me.
  if (p.index >= end) {
    const delta = p.index - end;
    p.index = start + replacement.length + delta;
  }
}

function eatComment(p) {
  assertString(p, "/*");
  eatUntil("*/", p);
  assertString(p, "*/");
}

function eatBlock(p) {
  const startIndex = p.index;
  assertString(p, "{");
  let level = 1;
  while (level != 0) {
    if (p.sheetSrc[p.index] === "{") {
      level++;
    } else if (p.sheetSrc[p.index] === "}") {
      level--;
    }
    advance(p);
  }
  const endIndex = p.index;
  const contents = p.sheetSrc.slice(startIndex, endIndex);

  // // console.log("eatBlock found this: >>" + contents + "<<");

  return { startIndex, endIndex, contents };
}

function advance(p) {
  p.index++;
  if (p.index > p.sheetSrc.length) {
    throw parseError(p, "Advanced beyond the end");
  }
}

function eatUntil(s, p) {
  const startIndex = p.index;
  while (!lookAhead(s, p)) {
    advance(p);
  }
  return p.sheetSrc.slice(startIndex, p.index);
}

function parseSelector(p) {
  let startIndex = p.index;
  eatUntil("{", p);
  if (startIndex === p.index) {
    throw Error("Empty selector");
  }

  // // console.log("parseSelector found this: >>" + p.sheetSrc.slice(startIndex, p.index) + "<<");

  return p.sheetSrc.slice(startIndex, p.index);
}

const whitespaceMatcher = /\s*/g;
function eatWhitespace(p) {
  // Start matching at the current position in the sheet src
  whitespaceMatcher.lastIndex = p.index;
  const match = whitespaceMatcher.exec(p.sheetSrc);
  if (match) {
    p.index += match[0].length;
  }
}

function lookAhead(s, p) {
  return p.sheetSrc.substr(p.index, s.length) == s;
}

function peek(p) {
  return p.sheetSrc[p.index];
}

function handleStyleTag(el) { // el: HtmlStyleElement
  // console.log("handleStyleTag");
  // Don’t touch empty style tags.
  if (el.innerHTML.trim().length === 0) {
    // console.log("innerHTML is empty");
    return;
  }
  // console.log("el.innerHTML " + el.innerHTML);
  const newSrc = transpileStyleSheet(el.innerHTML);
  // console.log("newSrc is " + newSrc);
  el.innerHTML = newSrc;

  // el.innerHTML = 
  // "#progress { " + 
  //     "width: 100%; " +
  //     "height: 20px; " + 
  //     "background: red;" + 
  //   " }";
}

function init() {
  // console.log("init is called event");

  const sheetObserver = new MutationObserver((entries) => {
    // console.log("call back of MutationObserver event");

    for (const entry of entries) {
      // // console.log("handling entry");
      for (const addedNode of entry.addedNodes) {
        if (addedNode instanceof HTMLStyleElement) {
          // console.log("&&& handleStyleTag event");
          handleStyleTag(addedNode);
        }
        if (addedNode instanceof HTMLLinkElement) {
          // handleLinkedStylesheet(addedNode);
          // console.log("handleLinkedStylesheet");
        }
      }
    }

    document.querySelectorAll("body *").forEach(element => {
      addProxyForElement(element);
    });

  });

  sheetObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // console.log("init call is finished event");
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

  const re = new RegExp('(^[0-9]+)(' + validScrollOffsetSuffixes.join('|') + ')');
  const matches = re.exec(part);
  if (matches) {
    return new CSSUnitValue(parseInt(matches[1]), matches[2]);
  }

  const matches_selector = /selector\(#([^)]+)\)[ ]{0,1}(start|end)*[ ]{0,1}([0-9]+[.]{0,1}[0-9]*)*/.exec(part);

  if (matches_selector) {
    if (document.getElementById(matches_selector[1])) {
      return {
        target: document.getElementById(matches_selector[1]),
        ...(matches_selector.length >= 3 ? { edge: matches_selector[2] } : {}),
        ...(matches_selector.length >= 4 ? { threshold: parseFloat(matches_selector[3]) } : {})
      };
    }
  }

  // todo selector
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

function saveScrollTimelineOptions(name, options) {
  scrollTimelineOptions.set(name, options);
}

function removeKeywordsFromAnimationShorthand(anim) {
  return anim.split(' ').filter(
    (item, index, array) => index == array.length - 1 || !animationKewords.includes(item))
    .filter(item => !isTime(item) && !isNumber(item));
}

function createScrollTimeline(name) {
  const options = scrollTimelineOptions.get(name);
  if (!options) return null;

  const sourceElement = getSourceElement(options.source);
  const scrollOffsets = getScrollOffsets(sourceElement, options['scroll-offsets']);

  // console.log(">> sourceElement " + options.source + " " + sourceElement);
  // console.log(">> orientation " + options.orientation);
  // console.log(">> scroll-offsets " + options['scroll-offsets']);
  // console.log(">> scrollOffsets " + scrollOffsets);

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
    // todo split value when prop=='animation-timeline'
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

const animationToScrollTimeline = new Map();
const scrollTimelineByName = new Map();
const scrollTimelineCSSRules = new Map();
const scrollTimelineOptions = new Map(); // save options by name

const animationKewords = [
  'normal', 'reverse', 'alternate', 'alternate-reverse',
  'none', 'forwards', 'backwards', 'both',
  'running', 'paused',
  'ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out'
];

function isTime(s) {
  const timeMatcher = /^[0-9]+(s|ms)/;
  return timeMatcher.exec(s);
}

function isNumber(s) {
  const numberMatcher = /^[0-9]+/;
  return numberMatcher.exec(s);
}

function getScrollTimelineName(animationName, target) {
  let target_timeline = animationToScrollTimeline.get(animationName);
  if (target_timeline) return target_timeline;

  scrollTimelineCSSRules.forEach((rule, timeline) => {
    // console.log(">> " + timeline + " " + rule);
    document.querySelectorAll(rule).forEach(element => {
      if (element == target) {
        target_timeline = timeline;
        // console.log("woww " + target_timeline);
      }
    })
  })
  return target_timeline;
}

console.log("here src/scroll-timeline-css.js");

export function initCSSPolyfill() {
  init();

  // window.addEventListener('load', (event) => {
  window.addEventListener('animationstart', (evt) => {
    // console.log("animationstart event");
    const anim =
      evt.target.getAnimations().filter(
        anim => anim.animationName == evt.animationName)[0];

    // console.log("event target#" + evt.path);

    const scrollTimelineName = getScrollTimelineName(anim.animationName, evt.target);

    if (scrollTimelineName) {
      const scrollTimeline = createScrollTimeline(scrollTimelineName);
      /*
      in order to be able to fix the element-based-offset
      which points to self, i should create scroll timeline here,
      and set the target to evt.target.
      const scrollTimeline = new ScrollTimeline({
        source: document.getElementById("myUL"),
        scrollOffsets: [
          { target: evt.target, edge: 'end', threshold: 0 },
          { target: evt.target, edge: 'end', threshold: 1 }
        ],
      });
      */

      // if there is a scrollTimeline name associated to this animation
      // cancel already, whether we create a new animation or not
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
        // console.log("just canceling");
        // anim.cancel();
      }
    }

    // let scrollTimelineName = getScrollTimelineByTarget(evt.target);
    // console.log(">>>> " + letScrollTimeline + " " + anim.animationName);

    // let matchedElements = document.querySelectorAll("#element_source_none").forEach(element => {
    //   if (element == evt.target) {
    //     console.log("animation started and matched querySelectorAll");
    //   }
    // });

  });
  // });
}
