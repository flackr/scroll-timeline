// 1 - Extracts @scroll-timeline and saves it in scrollTimelineOptions.
// 2 - If we find any animation-timeline in any of the CSS Rules, 
// we will save objects in a list named cssRulesWithTimelineName
export class StyleParser {
  constructor() {
    this.cssRulesWithTimelineName = [];
    this.scrollTimelineOptions = new Map(); // save options by name
  }

  // Inspired by
  // https://drafts.csswg.org/css-syntax/#parser-diagrams
  // https://github.com/GoogleChromeLabs/container-query-polyfill/blob/main/src/engine.ts
  transpileStyleSheet(sheetSrc, srcUrl) {
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
        this.scrollTimelineOptions.set(scrollTimeline.name, scrollTimeline);
      } else {
        const rule = this.parseQualifiedRule(p);
        if (!rule) continue;
        this.handleScrollTimelineProps(rule, p);
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

  getScrollTimelineName(animationName, target) {
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
    // TODO is it enough to check with "includes()"
    const hasAnimationName = rule.block.contents.includes("animation-name:");
    const hasScrollTimeline = rule.block.contents.includes("animation-timeline:");
    const hasAnimation = rule.block.contents.includes("animation:");

    // If both 'animation-timeline' and 'animation-name' are present,
    // save them in the list
    if (hasScrollTimeline && hasAnimationName) {
      let timelineNames = RegexMatcher.ANIMATION_TIMELINE
        .exec(rule.block.contents)?.[1]
        .trim().split(",").map(name => name.trim());

      let animationNames = RegexMatcher.ANIMATION_NAME
        .exec(rule.block.contents)?.[1]
        .trim().split(",").map(name => name.trim());

      for (let i = 0; i < timelineNames.length; i++) {
        this.cssRulesWithTimelineName.push({
          selector: rule.selector,
          'animation-name': animationNames[i],
          'animation-timeline': timelineNames[i]
        });
      }
      return;
    }

    let timelineName = RegexMatcher.ANIMATION_TIMELINE
      .exec(rule.block.contents)?.[1]
      .trim();

    let animationName = undefined;
    if (hasAnimationName) {
      animationName = RegexMatcher.ANIMATION_NAME
        .exec(rule.block.contents)?.[1]
        .trim();
    } else if (hasAnimation) {
      let shorthand = RegexMatcher.ANIMATION
        .exec(rule.block.contents)?.[1]
        .trim();

      if (shorthand) {
        let remainingTokens = removeKeywordsFromAnimationShorthand(shorthand);
        // TODO we are assuming the first one that is remaining is
        // definitely animation name, and the second one is definitely
        // scrollTimeline name, which may not be true!
        if (remainingTokens.length <= 2)
          animationName = remainingTokens[0];

        if (remainingTokens.length == 2) {
          timelineName = remainingTokens[1];
          // Remove timeline name from animation shorthand
          // so the native implementation works with the rest of the properties
          rule.block.contents = rule.block.contents.replace(
            timelineName,
            ""
          );
          this.replacePart(
            rule.block.startIndex,
            rule.block.endIndex,
            rule.block.contents,
            p
          );
        }
      }
    }

    if (animationName && timelineName) {
      this.cssRulesWithTimelineName.push({
        selector: rule.selector,
        'animation-name': animationName,
        'animation-timeline': timelineName
      });
    }

    // The animation-timeline property may not be used in keyframes
    if (timelineName && !rule.selector.includes("@keyframes")) {
      this.cssRulesWithTimelineName.push({
        selector: rule.selector,
        'animation-name': undefined,
        'animation-timeline': timelineName
      });
    }
  }

  parseIdentifier(p) {
    RegexMatcher.IDENTIFIER.lastIndex = p.index;
    const match = RegexMatcher.IDENTIFIER.exec(p.sheetSrc);
    if (!match) {
      throw this.parseError(p, "Expected an identifier");
    }
    p.index += match[0].length;
    return match[0];
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
      p.index += match[0].length;
    }
  }

  lookAhead(s, p) {
    return p.sheetSrc.substr(p.index, s.length) == s;
  }

  peek(p) {
    return p.sheetSrc[p.index];
  }
}

const RegexMatcher = {
  IDENTIFIER: /[\w\\\@_-]+/g,
  WHITE_SPACE: /\s*/g,
  NUMBER: /^[0-9]+/,
  TIME: /^[0-9]+(s|ms)/,
  ANIMATION_TIMELINE: /animation-timeline\s*:([^;}]+)/,
  ANIMATION_NAME: /animation-name\s*:([^;}]+)/,
  ANIMATION: /animation\s*:([^;}]+)/,
};

const ANIMATION_KEYWORDS = [
  'normal', 'reverse', 'alternate', 'alternate-reverse',
  'none', 'forwards', 'backwards', 'both',
  'running', 'paused',
  'ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out'
];

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
