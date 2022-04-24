const VALID_SCROLL_OFFSET_SUFFIXES = [
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

// This is also used in scroll-timeline-css.js
export const RegexMatcher = {
  IDENTIFIER: /[\w\\\@_-]+/g,
  WHITE_SPACE: /\s*/g,
  NUMBER: /^[0-9]+/,
  TIME: /^[0-9]+(s|ms)/,
  ANIMATION_TIMELINE: /animation-timeline\s*:([^;}]+)/,
  ANIMATION_NAME: /animation-name\s*:([^;}]+)/,
  ANIMATION: /animation\s*:([^;}]+)/,
  OFFSET_WITH_SUFFIX: new RegExp('(^[0-9]+)(' + VALID_SCROLL_OFFSET_SUFFIXES.join('|') + ')'),
  ELEMENT_OFFSET: /selector\(#([^)]+)\)[ ]{0,1}(start|end)*[ ]{0,1}([0-9]+[.]{0,1}[0-9]*)*/,
  SOURCE_ELEMENT: /selector\(#([^)]+)\)/,
};

// Used for ANIMATION_TIMELINE, ANIMATION_NAME and ANIMATION regex
const VALUES_CAPTURE_INDEX = 1;

const WHOLE_MATCH_INDEX = 0;

const ANIMATION_KEYWORDS = [
  'normal', 'reverse', 'alternate', 'alternate-reverse',
  'none', 'forwards', 'backwards', 'both',
  'running', 'paused',
  'ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out'
];

// 1 - Extracts @scroll-timeline and saves it in scrollTimelineOptions.
// 2 - If we find any animation-timeline in any of the CSS Rules, 
// we will save objects in a list named cssRulesWithTimelineName
export class StyleParser {
  constructor() {
    this.cssRulesWithTimelineName = [];
    this.scrollTimelineOptions = new Map(); // save options by name
    this.keyframeNames = new Set();
  }

  // Inspired by
  // https://drafts.csswg.org/css-syntax/#parser-diagrams
  // https://github.com/GoogleChromeLabs/container-query-polyfill/blob/main/src/engine.ts
  // This function is called twice, in the first pass we are interested in saving
  // @scroll-timeline and @keyframe names, in the second pass
  // we will parse other rules
  transpileStyleSheet(sheetSrc, firstPass, srcUrl) {
    // AdhocParser
    const p = {
      sheetSrc: sheetSrc,
      index: 0,
      name: srcUrl,
    };

    while (p.index < p.sheetSrc.length) {
      this.eatWhitespace(p);
      if (p.index >= p.sheetSrc.length) break;
      if (this.lookAhead("/*", p)) {
        while (this.lookAhead("/*", p)) {
          this.eatComment(p);
          this.eatWhitespace(p);
        }
        continue;
      }

      if (this.lookAhead("@scroll-timeline", p)) {
        const { scrollTimeline, startIndex, endIndex } = this.parseScrollTimeline(p);
        if (firstPass) this.scrollTimelineOptions.set(scrollTimeline.name, scrollTimeline);
      } else {
        const rule = this.parseQualifiedRule(p);
        if (!rule) continue;
        if (firstPass) {
          this.extractAndSaveKeyframeName(rule.selector);
        } else {
          this.handleScrollTimelineProps(rule, p);
        }
      }
    }

    // If this sheet has no srcURL (like from a <style> tag), we are done.
    // TODO: Otherwise, we have to find `url()` functions and resolve
    // relative and path-absolute URLs to absolute URLs.
    return p.sheetSrc;
  }

  getScrollTimelineName(animationName, target) {
    // Rules are pushed to cssRulesWithTimelineName list in the same order as they appear in style sheet.
    // We are traversing backwards to take the last sample of a rule in a style sheet.
    // TODO: Rule specificity should be taken into account, i.e. don't just take the last
    // rule that matches, instead take the one with the most specifity among those that match
    for (let i = this.cssRulesWithTimelineName.length - 1; i >= 0; i--) {
      const current = this.cssRulesWithTimelineName[i];
      if (target.matches(current.selector)) {
        if (!current['animation-name'] || current['animation-name'] == animationName) {
          return current['animation-timeline'];
        }
      }
    }

    return null;
  }

  parseScrollTimeline(p) {
    const startIndex = p.index;
    this.assertString(p, "@scroll-timeline");
    this.eatWhitespace(p);
    let name = this.parseIdentifier(p);
    this.eatWhitespace(p);
    this.assertString(p, "{"); // eats {
    this.eatWhitespace(p);

    let scrollTimeline = {
      name: name,
      source: "auto",
      orientation: undefined,
      'scroll-offsets': undefined
    };

    while (this.peek(p) !== "}") {
      const property = this.parseIdentifier(p);
      this.eatWhitespace(p);
      this.assertString(p, ":");
      this.eatWhitespace(p);
      scrollTimeline[property] = this.removeEnclosingDoubleQuotes(this.eatUntil(";", p));
      this.assertString(p, ";");
      this.eatWhitespace(p);
    }

    this.assertString(p, "}");
    const endIndex = p.index;
    this.eatWhitespace(p);
    return {
      scrollTimeline,
      startIndex,
      endIndex,
    };
  }

  handleScrollTimelineProps(rule, p) {
    // The animation-timeline property may not be used in keyframes
    if (rule.selector.includes("@keyframes")) {
      return;
    }

    // TODO is it enough to check with "includes()"
    const hasAnimationName = rule.block.contents.includes("animation-name:");
    const hasAnimationTimeline = rule.block.contents.includes("animation-timeline:");
    const hasAnimation = rule.block.contents.includes("animation:");

    let timelineNames = [];
    let animationNames = [];

    if (hasAnimationTimeline) {
      timelineNames = this.extractMatches(rule.block.contents, RegexMatcher.ANIMATION_TIMELINE);
    }

    if (hasAnimationName) {
      animationNames = this.extractMatches(rule.block.contents, RegexMatcher.ANIMATION_NAME);
    }

    if (hasAnimationTimeline && hasAnimationName) {
      this.saveRelationInList(rule, timelineNames, animationNames);
      return;
    }

    if (hasAnimation) {
      this.extractMatches(rule.block.contents, RegexMatcher.ANIMATION)
        .forEach(shorthand => {
          const animationName = this.extractAnimationName(shorthand);
          const timelineName = this.extractTimelineName(shorthand);
          if (animationName) animationNames.push(animationName);
          if (timelineName) {
            timelineNames.push(timelineName);
            // Remove timeline name from animation shorthand
            // so the native implementation works with the rest of the properties
            // Retain length of original name though, to play nice with multiple
            // animations that might have been applied
            rule.block.contents = rule.block.contents.replace(
              timelineName,
              " ".repeat(timelineName.length)
            );
            this.replacePart(
              rule.block.startIndex,
              rule.block.endIndex,
              rule.block.contents,
              p
            );
          }
        });
    }

    this.saveRelationInList(rule, timelineNames, animationNames);
  }

  saveRelationInList(rule, timelineNames, animationNames) {
    if (animationNames.length == 0) {
      for (let i = 0; i < timelineNames.length; i++) {
        this.cssRulesWithTimelineName.push({
          selector: rule.selector,
          'animation-name': undefined,
          'animation-timeline': timelineNames[i]
        });
      }
    } else {
      for (let i = 0; i < Math.max(timelineNames.length, animationNames.length); i++) {
        this.cssRulesWithTimelineName.push({
          selector: rule.selector,
          'animation-name': animationNames[i % animationNames.length],
          'animation-timeline': timelineNames[i % timelineNames.length]
        });
      }
    }

  }

  extractAnimationName(shorthand) {
    return this.findMatchingEntryInContainer(shorthand, this.keyframeNames);
  }

  extractTimelineName(shorthand) {
    return this.findMatchingEntryInContainer(shorthand, this.scrollTimelineOptions);
  }

  findMatchingEntryInContainer(shorthand, container) {
    const matches = shorthand.split(" ").filter(part => container.has(part))
    return matches ? matches[0] : null;
  }


  parseIdentifier(p) {
    RegexMatcher.IDENTIFIER.lastIndex = p.index;
    const match = RegexMatcher.IDENTIFIER.exec(p.sheetSrc);
    if (!match) {
      throw this.parseError(p, "Expected an identifier");
    }
    p.index += match[WHOLE_MATCH_INDEX].length;
    return match[WHOLE_MATCH_INDEX];
  }

  /**
   * @param {String} selector contains everything upto '{', eg: "@keyframes expand"
   */
  extractAndSaveKeyframeName(selector) {
    if (selector.startsWith("@keyframes")) {
      selector.split(" ").forEach((item, index) => {
        if (index > 0) {
          this.keyframeNames.add(item);
        }
      })
    }
  }

  parseQualifiedRule(p) {
    const startIndex = p.index;
    const selector = this.parseSelector(p).trim();
    if (!selector) return;
    const block = this.eatBlock(p);
    const endIndex = p.index;
    return {
      selector,
      block,
      startIndex,
      endIndex,
    };
  }

  removeEnclosingDoubleQuotes(s) {
    let startIndex = s[0] == '"' ? 1 : 0;
    let endIndex = s[s.length - 1] == '"' ? s.length - 1 : s.length;
    return s.substring(startIndex, endIndex);
  }

  assertString(p, s) {
    if (p.sheetSrc.substr(p.index, s.length) != s) {
      throw this.parseError(p, `Did not find expected sequence ${s}`);
    }
    p.index += s.length;
  }

  replacePart(start, end, replacement, p) {
    p.sheetSrc = p.sheetSrc.slice(0, start) + replacement + p.sheetSrc.slice(end);
    // If we are pointing past the end of the affected section, we need to
    // recalculate the string pointer. Pointing to something inside the section
    // that’s being replaced is undefined behavior. Sue me.
    if (p.index >= end) {
      const delta = p.index - end;
      p.index = start + replacement.length + delta;
    }
  }

  eatComment(p) {
    this.assertString(p, "/*");
    this.eatUntil("*/", p);
    this.assertString(p, "*/");
  }

  eatBlock(p) {
    const startIndex = p.index;
    this.assertString(p, "{");
    let level = 1;
    while (level != 0) {
      if (p.sheetSrc[p.index] === "{") {
        level++;
      } else if (p.sheetSrc[p.index] === "}") {
        level--;
      }
      this.advance(p);
    }
    const endIndex = p.index;
    const contents = p.sheetSrc.slice(startIndex, endIndex);

    return { startIndex, endIndex, contents };
  }

  advance(p) {
    p.index++;
    if (p.index > p.sheetSrc.length) {
      throw this.parseError(p, "Advanced beyond the end");
    }
  }

  eatUntil(s, p) {
    const startIndex = p.index;
    while (!this.lookAhead(s, p)) {
      this.advance(p);
    }
    return p.sheetSrc.slice(startIndex, p.index);
  }

  parseSelector(p) {
    let startIndex = p.index;
    this.eatUntil("{", p);
    if (startIndex === p.index) {
      throw Error("Empty selector");
    }

    return p.sheetSrc.slice(startIndex, p.index);
  }

  eatWhitespace(p) {
    // Start matching at the current position in the sheet src
    RegexMatcher.WHITE_SPACE.lastIndex = p.index;
    const match = RegexMatcher.WHITE_SPACE.exec(p.sheetSrc);
    if (match) {
      p.index += match[WHOLE_MATCH_INDEX].length;
    }
  }

  lookAhead(s, p) {
    return p.sheetSrc.substr(p.index, s.length) == s;
  }

  peek(p) {
    return p.sheetSrc[p.index];
  }

  extractMatches(contents, matcher) {
    return matcher.exec(contents)[VALUES_CAPTURE_INDEX].trim().split(",").map(item => item.trim());
  }
}

function isTime(s) {
  return RegexMatcher.TIME.exec(s);
}

function isNumber(s) {
  return RegexMatcher.NUMBER.exec(s);
}

export function removeKeywordsFromAnimationShorthand(anim) {
  return anim.split(' ').filter(
    (item, index, array) => index == array.length - 1 || !ANIMATION_KEYWORDS.includes(item))
    .filter(item => !isTime(item) && !isNumber(item));
}
