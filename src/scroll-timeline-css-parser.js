// This is also used in scroll-timeline-css.js
export const RegexMatcher = {
  IDENTIFIER: /[\w\\\@_-]+/g,
  WHITE_SPACE: /\s*/g,
  NUMBER: /^[0-9]+/,
  TIME: /^[0-9]+(s|ms)/,
  VIEW_TIMELINE: /view-timeline\s*:([^;}]+)/,
  VIEW_TIMELINE_NAME: /view-timeline-name\s*:([^;}]+)/,
  VIEW_TIMELINE_AXIS: /view-timeline-axis\s*:([^;}]+)/,
  ANIMATION_TIMELINE: /animation-timeline\s*:([^;}]+)/,
  ANIMATION_DELAY: /animation-delay\s*:([^;}]+)/,
  ANIMATION_END_DELAY: /animation-end-delay\s*:([^;}]+)/,
  ANIMATION_TIME_RANGE: /animation-time-range\s*:([^;}]+)/,
  ANIMATION_NAME: /animation-name\s*:([^;}]+)/,
  ANIMATION: /animation\s*:([^;}]+)/,
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

const VIEW_TIMELINE_AXIS_TYPES = ['block', 'inline',  'vertical', 'horizontal'];

// 1 - Extracts @scroll-timeline and saves it in scrollTimelineOptions.
// 2 - If we find any animation-timeline in any of the CSS Rules, 
// we will save objects in a list named cssRulesWithTimelineName
export class StyleParser {
  constructor() {
    this.cssRulesWithTimelineName = [];
    this.scrollTimelineOptions = new Map(); // save options by name
    this.subjectSelectorToViewTimeline = [];
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

  getAnimationTimelineOptions(animationName, target) {
    // Rules are pushed to cssRulesWithTimelineName list in the same order as they appear in style sheet.
    // We are traversing backwards to take the last sample of a rule in a style sheet.
    // TODO: Rule specificity should be taken into account, i.e. don't just take the last
    // rule that matches, instead take the one with the most specifity among those that match
    for (let i = this.cssRulesWithTimelineName.length - 1; i >= 0; i--) {
      const current = this.cssRulesWithTimelineName[i];
      if (target.matches(current.selector)) {
        if (!current['animation-name'] || current['animation-name'] == animationName) {
          return {
            'animation-timeline': current['animation-timeline'],
            'animation-delay': current['animation-delay'],
            'animation-end-delay': current['animation-end-delay'],
            'animation-time-range': current['animation-time-range']
          }
        }
      }
    }

    return null;
  }

  // This implementation is based on https://drafts.csswg.org/scroll-animations-1/
  // TODO: Should update accordingly when new spec lands.
  getSourceElement(source) {
    const matches = RegexMatcher.SOURCE_ELEMENT.exec(source);
    const SOURCE_CAPTURE_INDEX = 1;
    if (matches)
      return document.getElementById(matches[SOURCE_CAPTURE_INDEX]);
    else if (source === "auto")
      return document.scrollingElement;
    else
      return null;
  }

  getScrollTimelineOptions(timelineName) {
    const options = this.scrollTimelineOptions.get(timelineName);

    if(options?.source) {
      const sourceElement = this.getSourceElement(options.source);
      return {
        ...(sourceElement ? { source: sourceElement } : {}),
        ...(options.orientation != "auto" ? { orientation: options.orientation } : {}),
      };
    }

    return null;
  }

  getViewTimelineOptions(timelineName) {
    // TODO: Take into account the scoping of the ViewTimelines
    // https://github.com/w3c/csswg-drafts/issues/7047
    for (let i = this.subjectSelectorToViewTimeline.length - 1; i >= 0; i--) {
      const options = this.subjectSelectorToViewTimeline[i];
      if(options.name == timelineName) {
        const allSubjects = document.querySelectorAll(options.selector);
        if(allSubjects.length) {
          return {
            subject: allSubjects[allSubjects.length - 1],
            axis: options.axis,
          }
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

    this.saveSubjectSelectorToViewTimeline(rule);

    let timelineNames = [];
    let animationNames = [];

    if (hasAnimationTimeline)
      timelineNames = this.extractMatches(rule.block.contents, RegexMatcher.ANIMATION_TIMELINE);

    if (hasAnimationName)
      animationNames = this.extractMatches(rule.block.contents, RegexMatcher.ANIMATION_NAME);

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

          // If there is no duration, animationstart will not happen,
          // and polyfill will not work which is based on animationstart.
          // Add 1s as duration to fix this.
          if(timelineName || hasAnimationTimeline) {
            if(!this.hasDuration(shorthand)) {
              // TODO: Should keep track of whether duration is artificial or not,
              // so that we can later track that we need to update timing to
              // properly see duration as 'auto' for the polyfill.
              rule.block.contents = rule.block.contents.replace(
                "animation:",
                "animation: 1s "
              );
              this.replacePart(
                rule.block.startIndex,
                rule.block.endIndex,
                rule.block.contents,
                p
              );
            }
          }
        });
    }

    this.saveRelationInList(rule, timelineNames, animationNames);
  }

  saveSubjectSelectorToViewTimeline(rule) {
    const hasViewTimeline = rule.block.contents.includes("view-timeline:");
    const hasViewTimelineName = rule.block.contents.includes("view-timeline-name:");
    const hasViewTimelineAxis = rule.block.contents.includes("view-timeline-axis:");

    if(!hasViewTimeline && !hasViewTimelineName) return;

    let viewTimeline = {selector: rule.selector, name: '', axis: 'block'};

    if(hasViewTimeline) {
      const parts = this.extractMatches(rule.block.contents, RegexMatcher.VIEW_TIMELINE, separator=' ');
      if(parts.length == 1) {
        viewTimeline.name = parts[0];
      } else if(parts.length == 2) {
        if(VIEW_TIMELINE_AXIS_TYPES.includes(parts[0]))
          viewTimeline.axis = parts[0], viewTimeline.name = parts[1];
        else
          viewTimeline.axis = parts[1], viewTimeline.name = parts[0];
      }
    }

    if(hasViewTimelineName) {
      const parts = this.extractMatches(rule.block.contents, RegexMatcher.VIEW_TIMELINE_NAME);
      viewTimeline.name = parts[0];
    }

    if(hasViewTimelineAxis) {
      const parts = this.extractMatches(rule.block.contents, RegexMatcher.VIEW_TIMELINE_AXIS);
      if(VIEW_TIMELINE_AXIS_TYPES.includes(parts[0]))
        viewTimeline.axis = parts[0];
    }

    this.subjectSelectorToViewTimeline.push(viewTimeline);
  }

  hasDuration(shorthand) {
    return shorthand.split(" ").filter(part => isTime(part)).length >= 1;
  }

  saveRelationInList(rule, timelineNames, animationNames) {
    const hasAnimationDelay = rule.block.contents.includes("animation-delay:");
    const hasAnimationEndDelay = rule.block.contents.includes("animation-end-delay:");
    const hasAnimationTimeRange = rule.block.contents.includes("animation-time-range:");

    let animationDelays = [];
    let animationEndDelays = [];
    let animationTimeRanges = [];

    if (hasAnimationDelay)
      animationDelays = this.extractMatches(rule.block.contents, RegexMatcher.ANIMATION_DELAY);

    if (hasAnimationEndDelay)
      animationEndDelays = this.extractMatches(rule.block.contents, RegexMatcher.ANIMATION_END_DELAY);

    if (hasAnimationTimeRange)
      animationTimeRanges = this.extractMatches(rule.block.contents, RegexMatcher.ANIMATION_TIME_RANGE);

    const maxLength = Math.max(timelineNames.length, animationNames.length,
      animationDelays.length, animationEndDelays.length, animationTimeRanges.length);

    for (let i = 0; i < maxLength; i++) {
      this.cssRulesWithTimelineName.push({
        selector: rule.selector,
        'animation-timeline': timelineNames[i % timelineNames.length],
        ...(animationNames.length ? {'animation-name': animationNames[i % animationNames.length]}: {}),
        ...(animationDelays.length ? {'animation-delay': animationDelays[i % animationDelays.length]}: {}),
        ...(animationEndDelays.length ? {'animation-end-delay': animationEndDelays[i % animationEndDelays.length]}: {}),
        ...(animationTimeRanges.length ? {'animation-time-range': animationTimeRanges[i % animationTimeRanges.length]}: {}),
      });
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
    this.eatUntil("*/", p, true);
    this.assertString(p, "*/");
  }

  eatBlock(p) {
    const startIndex = p.index;
    this.assertString(p, "{");
    let level = 1;
    while (level != 0) {
      if(this.lookAhead("/*", p)) {
        this.eatComment(p);
        continue;
      }

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

  eatUntil(s, p, replaceWithSpace=false) {
    const startIndex = p.index;
    while (!this.lookAhead(s, p)) {
      this.advance(p);
    }

    if(replaceWithSpace) {
      p.sheetSrc = p.sheetSrc.slice(0, startIndex)
        + " ".repeat(p.index - startIndex)
        + p.sheetSrc.slice(p.index);
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

  extractMatches(contents, matcher, separator=',') {
    return matcher.exec(contents)[VALUES_CAPTURE_INDEX].trim().split(separator).map(item => item.trim());
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
