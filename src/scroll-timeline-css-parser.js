import { ANIMATION_DELAY_NAMES } from './proxy-animation';
import { getAnonymousSourceElement } from './scroll-timeline-base';

// This is also used in scroll-timeline-css.js
export const RegexMatcher = {
  IDENTIFIER: /[\w\\\@_-]+/g,
  WHITE_SPACE: /\s*/g,
  NUMBER: /^[0-9]+/,
  TIME: /^[0-9]+(s|ms)/,
  SCROLL_TIMELINE: /scroll-timeline\s*:([^;}]+)/,
  SCROLL_TIMELINE_NAME: /scroll-timeline-name\s*:([^;}]+)/,
  SCROLL_TIMELINE_AXIS: /scroll-timeline-axis\s*:([^;}]+)/,
  VIEW_TIMELINE: /view-timeline\s*:([^;}]+)/,
  VIEW_TIMELINE_NAME: /view-timeline-name\s*:([^;}]+)/,
  VIEW_TIMELINE_AXIS: /view-timeline-axis\s*:([^;}]+)/,
  VIEW_TIMELINE_INSET: /view-timeline-inset\s*:([^;}]+)/,
  ANIMATION_TIMELINE: /animation-timeline\s*:([^;}]+)/,
  ANIMATION_DELAY: /animation-delay\s*:([^;}]+)/,
  ANIMATION_END_DELAY: /animation-end-delay\s*:([^;}]+)/,
  ANIMATION_TIME_RANGE: /animation-time-range\s*:([^;}]+)/,
  ANIMATION_NAME: /animation-name\s*:([^;}]+)/,
  ANIMATION: /animation\s*:([^;}]+)/,
  ANONYMOUS_SCROLL: /scroll\(([^)]*)\)/,
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

const TIMELINE_AXIS_TYPES = ['block', 'inline',  'vertical', 'horizontal'];
const ANONYMOUS_TIMELINE_SOURCE_TYPES = ['nearest', 'root'];

// 1 - Extracts @scroll-timeline and saves it in scrollTimelineOptions.
// 2 - If we find any animation-timeline in any of the CSS Rules, 
// we will save objects in a list named cssRulesWithTimelineName
export class StyleParser {
  constructor() {
    this.cssRulesWithTimelineName = [];
    this.nextAnonymousTimelineNameIndex = 0;
    this.anonymousScrollTimelineOptions = new Map(); // save anonymous options by name
    this.sourceSelectorToScrollTimeline = [];
    this.subjectSelectorToViewTimeline = [];
    this.keyframeNamesSelectors = new Map();
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

      const rule = this.parseQualifiedRule(p);
      if (!rule) continue;
      if (firstPass)
        this.parseKeyframesAndSaveNameMapping(rule, p);
      else
        this.handleScrollTimelineProps(rule, p);
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

  getAnonymousScrollTimelineOptions(timelineName, target) {
    const options = this.anonymousScrollTimelineOptions.get(timelineName);
    if(options) {
      return {
        anonymousSource: options.source,
        anonymousTarget: target,
        source: getAnonymousSourceElement(options.source, target),
        orientation: (options.orientation ? options.orientation : 'block'),
      };
    }

    return null;
  }

  getScrollTimelineOptions(timelineName, target) {
    const anonymousTimelineOptions = this.getAnonymousScrollTimelineOptions(timelineName, target);
    if(anonymousTimelineOptions)
      return anonymousTimelineOptions;

    for (let i = this.sourceSelectorToScrollTimeline.length - 1; i >= 0; i--) {
      const options = this.sourceSelectorToScrollTimeline[i];
      if(options.name == timelineName) {
        const source = this.findPreviousSiblingOrAncestorMatchingSelector(target, options.selector);

        if(source) {
          return {
            source,
            ...(options.axis ? { orientation: options.axis } : {}),
          };
        }
      }
    }

    return null;
  }

  findPreviousSiblingOrAncestorMatchingSelector(target, selector) {
    // Target self
    let candidate = target;
    
    // Walk the DOM tree: preceding siblings and ancestors
    while (candidate) {
      if (candidate.matches(selector)) 
        return candidate;
      candidate = candidate.previousElementSibling || candidate.parentElement;
    }

    // No match
    return null;
  }

  getViewTimelineOptions(timelineName, target) {
    for (let i = this.subjectSelectorToViewTimeline.length - 1; i >= 0; i--) {
      const options = this.subjectSelectorToViewTimeline[i];
      if(options.name == timelineName) {
        const subject = this.findPreviousSiblingOrAncestorMatchingSelector(target, options.selector);
        if(subject) {
          return {
            subject,
            axis: options.axis,
            inset: options.inset
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

    this.saveSourceSelectorToScrollTimeline(rule);
    this.saveSubjectSelectorToViewTimeline(rule);

    let timelineNames = [];
    let animationNames = [];
    let shouldReplacePart = false;

    if (hasAnimationTimeline)
      timelineNames = this.extractScrollTimelineNames(rule.block.contents);

    if (hasAnimationName)
      animationNames = this.extractMatches(rule.block.contents, RegexMatcher.ANIMATION_NAME);

    if (hasAnimationTimeline && hasAnimationName) {
      this.saveRelationInList(rule, timelineNames, animationNames);
      return;
    }

    if (hasAnimation) {
      this.extractMatches(rule.block.contents, RegexMatcher.ANIMATION)
        .forEach(shorthand => {
          const r = this.extractTimelineName(shorthand);

          if(r.timelineName)
            timelineNames.push(r.timelineName);

          const animationName = this.extractAnimationName(shorthand);
          // Save this animation only if there is a scroll timeline.
          if (animationName && (r.timelineName || hasAnimationTimeline))
            animationNames.push(animationName);

          // If there is no duration, animationstart will not happen,
          // and polyfill will not work which is based on animationstart.
          // Add 1s as duration to fix this.
          if(r.timelineName || hasAnimationTimeline) {
            if(!this.hasDuration(shorthand)) {
              // TODO: Should keep track of whether duration is artificial or not,
              // so that we can later track that we need to update timing to
              // properly see duration as 'auto' for the polyfill.
              rule.block.contents = rule.block.contents.replace(
                shorthand, " 1s " + shorthand
              );
              shouldReplacePart = true;
            }
          }

          if(r.toBeReplaced) {
            // Remove timeline name from animation shorthand
            // so the native implementation works with the rest of the properties
            // Retain length of original name though, to play nice with multiple
            // animations that might have been applied
            rule.block.contents = rule.block.contents.replace(
              r.toBeReplaced,
              " ".repeat(r.toBeReplaced.length)
            );
            shouldReplacePart = true;
          }
        });
    }

    if(shouldReplacePart) {
      this.replacePart(
        rule.block.startIndex,
        rule.block.endIndex,
        rule.block.contents,
        p
      );
    }

    this.saveRelationInList(rule, timelineNames, animationNames);
  }

  saveSourceSelectorToScrollTimeline(rule) {
    const hasScrollTimeline = rule.block.contents.includes("scroll-timeline:");
    const hasScrollTimelineName = rule.block.contents.includes("scroll-timeline-name:");
    const hasScrollTimelineAxis = rule.block.contents.includes("scroll-timeline-axis:");

    if(!hasScrollTimeline && !hasScrollTimelineName) return;

    let timelines = [];
    if(hasScrollTimeline) {
      const scrollTimelines = this.extractMatches(rule.block.contents, RegexMatcher.SCROLL_TIMELINE);
      for(const st of scrollTimelines) {
        parts = this.split(st);
        let options = {selector: rule.selector, name: ''};

        if(parts.length == 1) {
          options.name = parts[0];
        } else if(parts.length == 2) {
          if(TIMELINE_AXIS_TYPES.includes(parts[0]))
            options.axis = parts[0], options.name = parts[1];
          else
            options.axis = parts[1], options.name = parts[0];
        }

        timelines.push(options);
      }
    }

    if(hasScrollTimelineName) {
      const names = this.extractMatches(rule.block.contents, RegexMatcher.SCROLL_TIMELINE_NAME);
      for(let i = 0; i < names.length; i++) {
        if(i < timelines.length) {
          // longhand overrides shorthand
          timelines[i].name = names[i];
        } else {
          let options = {selector: rule.selector, name: names[i]};
          timelines.push(options);
        }
      }
    }

    let axes = [];
    if(hasScrollTimelineAxis) {
      axes = this.extractMatches(rule.block.contents, RegexMatcher.SCROLL_TIMELINE_AXIS);
      axes = axes.filter(a => TIMELINE_AXIS_TYPES.includes(a));
    }

    for(let i = 0; i < timelines.length; i++) {
      if(axes.length)
        timelines[i].axis = axes[i % timelines.length];
    }

    this.sourceSelectorToScrollTimeline.push(...timelines);
  }

  saveSubjectSelectorToViewTimeline(rule) {
    const hasViewTimeline = rule.block.contents.includes("view-timeline:");
    const hasViewTimelineName = rule.block.contents.includes("view-timeline-name:");
    const hasViewTimelineAxis = rule.block.contents.includes("view-timeline-axis:");
    const hasViewTimelineInset = rule.block.contents.includes("view-timeline-inset:");

    if(!hasViewTimeline && !hasViewTimelineName) return;

    let timelines = [];

    if(hasViewTimeline) {
      const viewTimelines = this.extractMatches(rule.block.contents, RegexMatcher.VIEW_TIMELINE);
      for(let tl of viewTimelines) {
        parts = this.split(tl);
        let options = {selector: rule.selector, name: '', inset: null};
        if(parts.length == 1) {
          options.name = parts[0];
        } else if(parts.length == 2) {
          if(TIMELINE_AXIS_TYPES.includes(parts[0]))
            options.axis = parts[0], options.name = parts[1];
          else
            options.axis = parts[1], options.name = parts[0];
        }
        timelines.push(options);
      }
    }

    if(hasViewTimelineName) {
      const names = this.extractMatches(rule.block.contents, RegexMatcher.VIEW_TIMELINE_NAME);
      for(let i = 0; i < names.length; i++) {
        if(i < timelines.length) {
          // longhand overrides shorthand
          timelines[i].name = names[i];
        } else {
          let options = {selector: rule.selector, name: names[i], inset: null};
          timelines.push(options);
        }
      }
    }

    let insets = [];
    let axes = [];

    if(hasViewTimelineInset)
      insets = this.extractMatches(rule.block.contents, RegexMatcher.VIEW_TIMELINE_INSET);

    if(hasViewTimelineAxis) {
      axes = this.extractMatches(rule.block.contents, RegexMatcher.VIEW_TIMELINE_AXIS);
      axes = axes.filter(a => TIMELINE_AXIS_TYPES.includes(a));
    }

    for(let i = 0; i < timelines.length; i++) {
      if(insets.length)
        timelines[i].inset = insets[i % timelines.length];

      if(axes.length)
        timelines[i].axis = axes[i % timelines.length];
    }

    this.subjectSelectorToViewTimeline.push(...timelines);
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

  extractScrollTimelineNames(contents) {
    const value = RegexMatcher.ANIMATION_TIMELINE.exec(contents)[1].trim();
    const timelineNames = [];

    value.split(",").map(part => part.trim()).forEach(part => {
      if(isAnonymousScrollTimeline(part)) {
        const name = this.saveAnonymousTimelineName(part);
        timelineNames.push(name);
      } else {
        timelineNames.push(part);
      }
    });

    return timelineNames;
  }

  saveAnonymousTimelineName(part) {
    // Anonymous scroll timelines are given a name that starts with ':' to
    // prevent collision with named scroll timelines.
    const name = `:t${this.nextAnonymousTimelineNameIndex++}`;
    this.anonymousScrollTimelineOptions.set(name, this.parseAnonymousTimeline(part));
    return name;
  }

  parseAnonymousTimeline(part) {
    const anonymousMatch = RegexMatcher.ANONYMOUS_SCROLL.exec(part);
    if(!anonymousMatch)
      return null;

    const value = anonymousMatch[VALUES_CAPTURE_INDEX];
    const options = {};
    value.split(" ").forEach(token => {
      if(TIMELINE_AXIS_TYPES.includes(token)) {
        options['orientation'] = token;
      } else if(ANONYMOUS_TIMELINE_SOURCE_TYPES.includes(token)) {
        options['source'] = token;
      }
    });

    return options;
  }

  extractAnimationName(shorthand) {
    return this.findMatchingEntryInContainer(shorthand, this.keyframeNamesSelectors);
  }

  extractTimelineName(shorthand) {
    let timelineName = null;
    let toBeReplaced = null; // either timelineName or anonymousTimeline

    const anonymousMatch = RegexMatcher.ANONYMOUS_SCROLL.exec(shorthand);
    if(!anonymousMatch) {
      timelineName =
          this.findMatchingEntryInContainer(
              shorthand,
              new Set(this.sourceSelectorToScrollTimeline.map(o => o.name))) ||
          this.findMatchingEntryInContainer(
              shorthand,
              new Set(this.subjectSelectorToViewTimeline.map(o => o.name)));
      toBeReplaced = timelineName;
    } else {
      const anonymousTimeline = anonymousMatch[WHOLE_MATCH_INDEX];
      timelineName = this.saveAnonymousTimelineName(anonymousTimeline);
      toBeReplaced = anonymousTimeline;
    }

    return { timelineName, toBeReplaced };
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

  parseKeyframesAndSaveNameMapping(rule, p) {
    if (rule.selector.startsWith("@keyframes")) {
      const mapping = this.replaceKeyframesAndGetMapping(rule, p);
      rule.selector.split(" ").forEach((item, index) => {
        if (index > 0)
          this.keyframeNamesSelectors.set(item, mapping);
      })
    }
  }

  /*
  Replaces this:
    {
      0% { opacity: 0 }
      enter 100% { opacity: 1 }
      exit 0% { opacity: 1 }
      exit 100% { opacity: 0 }
      to { opacity: 1 }
    }
  with this:
    {
      0% { opacity: 0 }
      20% { opacity: 1 }
      40% { opacity: 1 }
      60% { opacity: 0 }
      80% { opacity: 1 }
    }
  and returns a mapping of { "0.00%": "0%", "20.00%" : "enter 100%", "40.00%" : "exit 0%", ... }
  If there are no phases in the keyframe selectors, nothing will happen
  and an empty map is returned.
  This change in keyframes is temporary, and when we are creating ScrollTimeline,
  if the underlying animation has a mapping, we will calculate new offsets and set new keyframes.
  */
  replaceKeyframesAndGetMapping(rule, p) {
    function hasPhase(selector) {
      return ANIMATION_DELAY_NAMES.some(phase => selector.startsWith(phase));
    }

    function cleanFrameSelector(selector) {
      return selector.split(" ").map(h => h.trim()).filter(p => p != "").join(" ");
    }

    function getFrameSelectorIndexes(contents) {
      let open = 0;
      let startIndex = -1;
      let endIndex = -1;
      const indexes = [];

      for(let i = 0; i < contents.length; i++) {
        if(contents[i] == '{')
          open++;
        else if(contents[i] == '}')
          open--;

        if(open == 1 && contents[i] != '{' && contents[i] != '}') {
          if(startIndex == -1)
            startIndex = i;
        }

        if(open == 2 && contents[i] == '{') {
          endIndex = i;
          indexes.push({start: startIndex, end: endIndex});
          startIndex = endIndex = -1;
        }
      }
      return indexes;
    }

    const contents = rule.block.contents;
    const parts = getFrameSelectorIndexes(contents);

    if(parts.length == 0)
      return new Map();

    const mapping = new Map();
    let foundPhaseLinkedOffset = false;
    const newContents = [];
    newContents.push(contents.substring(0, parts[0].start));
    for(let i = 0; i < parts.length; i++) {
      const allFrameSelectors = contents.substring(parts[i].start, parts[i].end);
      let replacedFrameSelectors = [];

      allFrameSelectors.split(",").forEach(currentFrameSelector => {
        const trimmedFrameSelector = cleanFrameSelector(currentFrameSelector);
        // There is no need to treat 'from' and 'to' differently,
        // Let's say some implicit keyframes for 'from' and 'to' are added to the
        // keyframes, after we are converting keyframes back, we will ignore them
        // because they have no presence in the mapping.
        // TODO: total number of keyframes > 100 is not supported at the moment.
        const newFrameSelector = mapping.size;
        mapping.set(newFrameSelector, trimmedFrameSelector);
        replacedFrameSelectors.push(`${newFrameSelector}%`);
        if(hasPhase(trimmedFrameSelector))
          foundPhaseLinkedOffset = true;
      });

      newContents.push(replacedFrameSelectors.join(","));

      if(i == parts.length-1)
        newContents.push(contents.substring(parts[i].end));
      else
        newContents.push(contents.substring(parts[i].end, parts[i+1].start));
    }

    if(foundPhaseLinkedOffset) {
      rule.block.contents = newContents.join("");
      this.replacePart(
        rule.block.startIndex,
        rule.block.endIndex,
        rule.block.contents,
        p
      );
      return mapping;
    } else {
      return new Map();
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

  split(contents) {
    return contents.split(" ").map(item => item.trim())
      .filter(item => item != "");
  }
}

function isAnonymousScrollTimeline(part) {
  return part.startsWith("scroll") && part.includes("(");
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
