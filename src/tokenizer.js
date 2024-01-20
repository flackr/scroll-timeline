
export class Token {}

// The output of tokenization step is a stream of zero or more of the following tokens: <ident-token>, <function-token>,
// <at-keyword-token>, <hash-token>, <string-token>, <bad-string-token>, <url-token>, <bad-url-token>, <delim-token>,
// <number-token>, <percentage-token>, <dimension-token>, <whitespace-token>, <CDO-token>, <CDC-token>, <colon-token>,
// <semicolon-token>, <comma-token>, <[-token>, <]-token>, <(-token>, <)-token>, <{-token>, and <}-token>.
export class IdentToken extends Token {
  value;
  constructor(value) {
    super();
    this.value = value;
  }
}

export class FunctionToken extends Token {
  value;
  constructor(value) {
    super();
    this.value = value;
  }
}

export class AtKeywordToken extends Token {
  value;
  constructor(value) {
    super();
    this.value = value;
  }
}

export class HashToken extends Token {
  type;
  value;
  constructor(value, type = 'unrestricted') {
    super();
    this.value = value;
    this.type = type;
  }
}

export class StringToken extends Token {
  value;
  constructor(value) {
    super();
    this.value = value;
  }
}

export class BadStringToken extends Token {}

export class UrlToken extends Token {
  value;
  constructor(value) {
    super();
    this.value = value;
  }
}

export class BadUrlToken extends Token {}

export class DelimToken extends Token {
  value;
  constructor(value) {
    super();
    this.value = value;
  }
}

export class NumberToken extends Token {
  value;
  type;
  constructor(value, type = "integer") {
    super();
    this.value = value;
    this.type = type;
  }
}

export class PercentageToken extends Token {
  value;
  constructor(value) {
    super();
    this.value = value;
  }
}

export class DimensionToken extends Token {
  value;
  type;
  unit;
  constructor(value, type, unit) {
    super();
    this.value = value;
    this.type = type;
    this.unit = unit;
  }
}

export class WhitespaceToken extends Token {}

export class CDOToken extends Token {}

export class CDCToken extends Token {}

export class ColonToken extends Token {}

export class SemicolonToken extends Token {}

export class CommaToken extends Token {}

export class LeftSquareBracketToken extends Token {}

export class RightSquareBracketToken extends Token {}

export class LeftParenthesisToken extends Token {}

export class RightParenthesisToken extends Token {}

export class LeftCurlyBracketToken extends Token {}

export class RightCurlyBracketToken extends Token {}

class InputStream {
  input
  index = 0;
  constructor(input) {
    this.input = input;
  }

  consume() {
    const codePoint = this.input.codePointAt(this.index);
    if (typeof codePoint !== 'undefined') {
      this.index += String.fromCodePoint(codePoint).length;
    }
    return codePoint;
  }

  reconsume(codePoint) {
    if (typeof codePoint !== 'undefined') {
      this.index -= String.fromCodePoint(codePoint).length
    }
  }

  peek() {
    const codePoints = []
    let position = this.index
    for (let i = 0; i < 3 && position < this.input.length; i++) {
      const nextCodePoint = this.input.codePointAt(position);
      codePoints.push(nextCodePoint);
      position += String.fromCodePoint(nextCodePoint).length;
    }
    return codePoints;
  }
}

function isNewline(codePoint) {
  // U+000A LINE FEED.
  return codePoint === 0x000A;
}
function isWhitespace(codePoint) {
  // A newline, U+0009 CHARACTER TABULATION, or U+0020 SPACE.
  return isNewline(codePoint) || codePoint === 0x2000 || codePoint === 0x0020;
}

function isDigit(codePoint) {
  // A code point between U+0030 DIGIT ZERO (0) and U+0039 DIGIT NINE (9) inclusive.
  return codePoint >= 0x0030 && codePoint <=0x0039;
}

function isHexDigit(codePoint) {
  // A digit, or a code point between U+0041 LATIN CAPITAL LETTER A (A) and U+0046 LATIN CAPITAL LETTER F (F) inclusive,
  // or a code point between U+0061 LATIN SMALL LETTER A (a) and U+0066 LATIN SMALL LETTER F (f) inclusive.
  return isDigit(codePoint) ||
    (codePoint >= 0x0041 && codePoint <= 0x0046) ||
    (codePoint >= 0x0061 && codePoint <= 0x0066);
}

function isUppercaseLetter(codePoint) {
  // A code point between U+0041 LATIN CAPITAL LETTER A (A) and U+005A LATIN CAPITAL LETTER Z (Z) inclusive.
  return codePoint >= 0x0041 && codePoint <= 0x005A;
}

function isLowercaseLetter(codePoint) {
  // A code point between U+0061 LATIN SMALL LETTER A (a) and U+007A LATIN SMALL LETTER Z (z) inclusive.
  return codePoint >= 0x0061 && codePoint <= 0x007A;
}

function isLetter(codePoint) {
  // An uppercase letter or a lowercase letter.
  return isUppercaseLetter(codePoint) || isLowercaseLetter(codePoint);
}

function nonASCIICodePoint(codePoint) {
  // A code point with a value equal to or greater than U+0080 <control>.
  return codePoint >= 0x0080;
}
function isIdentStartCodePoint(codePoint) {
  // A letter, a non-ASCII code point, or U+005F LOW LINE (_).
  return isLetter(codePoint) || nonASCIICodePoint(codePoint) || codePoint === 0x005F;
}

function isIdentCodePoint(codePoint) {
  // An ident-start code point, a digit, or U+002D HYPHEN-MINUS (-).
  return isIdentStartCodePoint(codePoint) || isDigit(codePoint) || codePoint === 0x002D;
}

function isNonPrintableCodePoint(codePoint) {
  // A code point between U+0000 NULL and U+0008 BACKSPACE inclusive, or U+000B LINE TABULATION,
  // or a code point between U+000E SHIFT OUT and U+001F INFORMATION SEPARATOR ONE inclusive, or U+007F DELETE.
  return (codePoint >= 0x0000 && codePoint <= 0x0008) || codePoint === 0x000B ||
    (codePoint >= 0x000E && codePoint <= 0x001F) || codePoint === 0x007F;
}

function validEscape(firstCodePoint, secondCodePoint) {
  // If the first code point is not U+005C REVERSE SOLIDUS (\), return false.
  // Otherwise, if the second code point is a newline, return false.
  // Otherwise, return true.
  return firstCodePoint === 0x005C && !isNewline(secondCodePoint);
}

function startsIdentSequence(firstCodePoint, secondCodePoint, thirdCodePoint) {
  // Look at the first code point:
  if (firstCodePoint === 0x002D) {
    // U+002D HYPHEN-MINUS
    // If the second code point is an ident-start code point or a U+002D HYPHEN-MINUS,
    // or the second and third code points are a valid escape, return true. Otherwise, return false.
    return isIdentStartCodePoint(secondCodePoint) || secondCodePoint === 0x002D ||
      validEscape(secondCodePoint, thirdCodePoint);
  } else if (isIdentStartCodePoint(firstCodePoint)) {
    // ident-start code point
    // Return true.
    return true;
  } else if (firstCodePoint === 0x005C) {
    // U+005C REVERSE SOLIDUS (\)
    // If the first and second code points are a valid escape, return true. Otherwise, return false.
    return validEscape(firstCodePoint, secondCodePoint);
  } else {
    // anything else
    // Return false.
    return false;
  }
}

function startsNumber(firstCodePoint, secondCodePoint, thirdCodePoint) {
  // https://www.w3.org/TR/css-syntax-3/#check-if-three-code-points-would-start-a-number
  // Look at the first code point:

  if (firstCodePoint === 0x002B || firstCodePoint === 0x002D) {
    // U+002B PLUS SIGN (+)
    // U+002D HYPHEN-MINUS (-)
    // If the second code point is a digit, return true.
    // Otherwise, if the second code point is a U+002E FULL STOP (.) and the third code point is a digit, return true.
    //
    // Otherwise, return false.
    return isDigit(secondCodePoint) || (secondCodePoint === 0x002E && isDigit(thirdCodePoint));
  } else if (firstCodePoint === 0x002E) {
    // U+002E FULL STOP (.)
    // If the second code point is a digit, return true. Otherwise, return false.
    return isDigit(secondCodePoint);
  } else {
    // digit
    // Return true.
    // anything else
    // Return false.
    return isDigit(firstCodePoint);
  }
}

/**
 * Consume an escaped code point
 * https://www.w3.org/TR/css-syntax-3/#consume-an-escaped-code-point
 *
 * @param {InputStream} input
 * @return number
 */
function consumeEscapedCodePoint(input) {
  // Consume the next input code point.
  const codePoint = input.consume();
  if (isHexDigit(codePoint)) {
    let digits = [codePoint];
    // hex digit
    // Consume as many hex digits as possible, but no more than 5. Note that this means 1-6 hex digits have been
    // consumed in total.
    while(isHexDigit(...input.peek()) && digits.length < 5) {
      digits.push(input.consume());
    }

    // If the next input code point is whitespace, consume it as well.
    if (isWhitespace(...input.peek())) {
      input.consume();
    }

    // Interpret the hex digits as a hexadecimal number. If this number is zero, or is for a surrogate, or is greater
    // than the maximum allowed code point, return U+FFFD REPLACEMENT CHARACTER (�). Otherwise, return the code point
    // with that value.
    const number = parseInt(String.fromCodePoint(...digits), 16);
    if (number === 0 || number > 0x10FFFF) {
      return 0xFFFD;
    } else {
      return number;
    }
  } else if (typeof codePoint === 'undefined') {
    // EOF
    // This is a parse error. Return U+FFFD REPLACEMENT CHARACTER (�).
    return 0xFFFD;
  } else {
    // anything else
    // Return the current input code point.
    return codePoint;
  }
}


/**
 * Consume a string token
 * https://www.w3.org/TR/css-syntax-3/#consume-a-string-token
 *
 * @param {InputStream} input
 * @param {number} endingCodePoint
 */
function consumeStringToken(input, endingCodePoint) {
  const stringToken = new StringToken('');

  while (true) {
    // Repeatedly consume the next input code point from the stream:
    const codePoint = input.consume();
    if (codePoint === endingCodePoint) {
      // ending code point
      // Return the <string-token>.
      return stringToken;
    } else if (typeof codePoint === 'undefined') {
      // EOF
      // This is a parse error. Return the <string-token>.
      return stringToken
    } else if (codePoint === 0x00A) {
      // newline
      // This is a parse error. Reconsume the current input code point, create a <bad-string-token>, and return it.
      input.reconsume(codePoint);
      return new BadStringToken();
    } else if (codePoint === 0x005C) {
      // U+005C REVERSE SOLIDUS (\)
      const nextCodePoint = input.peek()[0];
      if (typeof nextCodePoint === 'undefined') {
        // If the next input code point is EOF, do nothing.
      } else if (isNewline(nextCodePoint)) {
        // Otherwise, if the next input code point is a newline, consume it.
        input.consume();
      } else {
        // Otherwise, (the stream starts with a valid escape) consume an escaped code point and
        // append the returned code point to the <string-token>’s value.
        stringToken.value += String.fromCodePoint(consumeEscapedCodePoint(input));
      }
    } else {
      // anything else
      // Append the current input code point to the <string-token>’s value.
      stringToken.value += String.fromCodePoint(codePoint);
    }
  }
}

/**
 * Consume ident sequence
 * https://www.w3.org/TR/css-syntax-3/#consume-name
 *
 * @param {InputStream} input
 */
function consumeIdentSequence(input) {
  // Let result initially be an empty string.
  let result = '';

  // Repeatedly consume the next input code point from the stream:
  while (true) {
    const codePoint = input.consume();
    if (isIdentCodePoint(codePoint)) {
      // ident code point
      // Append the code point to result.
      result += String.fromCodePoint(codePoint);
    } else if (validEscape(...input.peek())) {
      // the stream starts with a valid escape
      // Consume an escaped code point. Append the returned code point to result.
      result += String.fromCodePoint(consumeEscapedCodePoint(input));
    } else {
      // anything else
      // Reconsume the current input code point. Return result.
      input.reconsume(codePoint);
      return result;
    }
  }
}

/**
 * Consume a number
 * https://www.w3.org/TR/css-syntax-3/#consume-a-number
 *
 * @param {InputStream} input
 */
function consumeNumber(input) {
  // Execute the following steps in order:
  //
  // Initially set type to "integer". Let repr be the empty string.
  let type = 'integer';
  let repr = '';

  // If the next input code point is U+002B PLUS SIGN (+) or U+002D HYPHEN-MINUS (-), consume it and append it to repr.
  if ([0x002B, 0x002D].includes(input.peek()[0])) {
    repr += String.fromCodePoint(input.consume());
  }

  // While the next input code point is a digit, consume it and append it to repr.
  while(isDigit(...input.peek())) {
    repr += String.fromCodePoint(input.consume());
  }

  // If the next 2 input code points are U+002E FULL STOP (.) followed by a digit, then:
  //   Consume them.
  //   Append them to repr.
  //   Set type to "number".
  //   While the next input code point is a digit, consume it and append it to repr.
  if (input.peek()[0] === 0x002E && isDigit(input.peek()[1])) {
    repr += String.fromCodePoint(input.consume(), input.consume());
    type = 'number';
    while(isDigit(...input.peek())) {
      repr += String.fromCodePoint(input.consume());
    }
  }

  // If the next 2 or 3 input code points are U+0045 LATIN CAPITAL LETTER E (E) or U+0065 LATIN SMALL LETTER E (e),
  // optionally followed by U+002D HYPHEN-MINUS (-) or U+002B PLUS SIGN (+),
  // followed by a digit, then:
  //   Consume them.
  //   Append them to repr.
  //   Set type to "number".
  //   While the next input code point is a digit, consume it and append it to repr.
  if ([0x0045, 0x0065].includes(input.peek()[0])) {
    if ([0x002D, 0x002B].includes(input.peek()[1]) && isDigit(input.peek()[2])) {
      repr += String.fromCodePoint(input.consume(), input.consume(), input.consume());
      type = 'number';
    } else if (isDigit(input.peek()[1])) {
      repr += String.fromCodePoint(input.consume(), input.consume());
      type = 'number';
    }
  }

  // Convert repr to a number, and set the value to the returned value.
  const value = parseFloat(repr);
  // Return value and type.
  return { value, type };
}

/**
 * Consume a numeric token
 * https://www.w3.org/TR/css-syntax-3/#consume-a-numeric-token
 *
 * @param {InputStream} input
 */
function consumeNumericToken(input) {
  // Consume a number and let number be the result.
  let number = consumeNumber(input);
  // If the next 3 input code points would start an ident sequence, then:
  if (startsIdentSequence(...input.peek())) {
    // Create a <dimension-token> with the same value and type flag as number, and a unit set initially to the empty string.
    // Consume an ident sequence. Set the <dimension-token>’s unit to the returned value.
    // Return the <dimension-token>.
    return new DimensionToken(number.value, number.type, consumeIdentSequence(input));
  } else if (input.peek()[0] === 0x0025) {
    // Otherwise, if the next input code point is U+0025 PERCENTAGE SIGN (%), consume it.
    // Create a <percentage-token> with the same value as number, and return it.
    input.consume();
    return new PercentageToken(number.value);
  } else {
    // Otherwise, create a <number-token> with the same value and type flag as number, and return it.
    return new NumberToken(number.value, number.type);
  }
}

/**
 * Consume remnants of a bad url
 * https://www.w3.org/TR/css-syntax-3/#consume-the-remnants-of-a-bad-url
 * @param {InputStream} input
 */
function consumeRemnantsOfBadUrl(input) {
  // Repeatedly consume the next input code point from the stream:
  while (true) {
    const codePoint = input.consume();
    if (codePoint === 0x0029 || typeof codePoint === 'undefined') {
      // U+0029 RIGHT PARENTHESIS ())
      // EOF
      // Return.
      return;
    } else if (validEscape(...input.peek())) {
      // the input stream starts with a valid escape
      // Consume an escaped code point. This allows an escaped right parenthesis ("\)") to be encountered without
      // ending the <bad-url-token>. This is otherwise identical to the "anything else" clause.
      consumeEscapedCodePoint(input);
    }
    // anything else
    // Do nothing.
  }
}

/**
 * Consume URL token
 * https://www.w3.org/TR/css-syntax-3/#consume-a-url-token
 * @param {InputStream} input
 */
function consumeUrlToken(input) {
  // Initially create a <url-token> with its value set to the empty string.
  const urlToken = new UrlToken('');

  // Consume as much whitespace as possible.
  while(isWhitespace(...input.peek())) {
    input.consume();
  }

  // Repeatedly consume the next input code point from the stream:
  while (true) {
    const codePoint = input.consume();
    if (codePoint === 0x0029) {

      // U+0029 RIGHT PARENTHESIS ())
      // Return the <url-token>.
      return urlToken;
    } else if (typeof codePoint === 'undefined') {
      // EOF
      // This is a parse error. Return the <url-token>.
      return urlToken;
    } else if (isWhitespace(codePoint)) {
      // whitespace
      // Consume as much whitespace as possible.
      while(isWhitespace(...input.peek())) {
        input.consume();
      }
      if (input.peek()[0] === 0x0029 || typeof input.peek()[0] === 'undefined') {
        // If the next input code point is U+0029 RIGHT PARENTHESIS ()) or EOF,
        // consume it and return the <url-token> (if EOF was encountered, this is a parse error);
        input.consume();
        return urlToken;
      } else {
        // otherwise, consume the remnants of a bad url, create a <bad-url-token>, and return it.
        consumeRemnantsOfBadUrl(input);
        return new BadUrlToken();
      }
    } else if ([0x0022, 0x0027, 0x0028].includes(codePoint) || isNonPrintableCodePoint(codePoint)) {
      // U+0022 QUOTATION MARK (")
      // U+0027 APOSTROPHE (')
      // U+0028 LEFT PARENTHESIS (()
      // non-printable code point
      // This is a parse error. Consume the remnants of a bad url, create a <bad-url-token>, and return it.
      consumeRemnantsOfBadUrl(input);
      return new BadUrlToken();
    } else if (codePoint === 0x005C) {
      // U+005C REVERSE SOLIDUS (\)
      if (validEscape(...input.peek())) {
        // If the stream starts with a valid escape,
        // consume an escaped code point and append the returned code point to the <url-token>’s value.
        urlToken.value += consumeEscapedCodePoint(input);
      } else {
        // Otherwise, this is a parse error. Consume the remnants of a bad url, create a <bad-url-token>, and return it.
        consumeRemnantsOfBadUrl(input);
        return new BadUrlToken();
      }
    } else {
      // anything else
      // Append the current input code point to the <url-token>’s value.
      urlToken.value += String.fromCodePoint(codePoint);
    }
  }
}

/**
 * Consume ident like token
 * https://www.w3.org/TR/css-syntax-3/#consume-an-ident-like-token
 *
 * @param {InputStream} input
 */
function consumeIdentLikeToken(input) {
  // Consume an ident sequence, and let string be the result.
  const str = consumeIdentSequence(input);
  if (str.match(/url/i) && input.peek()[0] === 0x0028) {
    // If string’s value is an ASCII case-insensitive match for "url",
    // and the next input code point is U+0028 LEFT PARENTHESIS ((), consume it.
    input.consume();
    // While the next two input code points are whitespace, consume the next input code point.
    while(isWhitespace(input.peek()[0]) && isWhitespace(input.peek()[1])) {
      input.consume();
    }

    if ([0x0022, 0x0027].includes(input.peek()[0]) ||
      (isWhitespace(input.peek()[0]) && [0x0022, 0x0027].includes(input.peek()[1]))) {
      // If the next one or two input code points are U+0022 QUOTATION MARK ("), U+0027 APOSTROPHE ('),
      // or whitespace followed by U+0022 QUOTATION MARK (") or U+0027 APOSTROPHE ('),
      // then create a <function-token> with its value set to string and return it.
      return new FunctionToken(str);
    } else {
      // Otherwise, consume a url token, and return it.
      return consumeUrlToken(input);
    }
  } else if (input.peek()[0] === 0x0028) {
    // Otherwise, if the next input code point is U+0028 LEFT PARENTHESIS ((), consume it.
    // Create a <function-token> with its value set to string and return it.
    input.consume();
    return new FunctionToken(str);
  } else {
    // Otherwise, create an <ident-token> with its value set to string and return it.
    return new IdentToken(str);
  }
}
/**
 * Consume a token.
 *
 * https://www.w3.org/TR/css-syntax-3/#consume-a-token
 *
 * @param {InputStream} input
 */
function consumeToken(input) {
  // Consume the next input code point
  const codePoint = input.consume()
  const lookahead = input.peek()
  if (isWhitespace(codePoint)) {
    // whitespace
    // Consume as much whitespace as possible. Return a <whitespace-token>.
    while(isWhitespace(...input.peek())) {
      input.consume();
    }
    return new WhitespaceToken();
  } else if (codePoint === 0x0022) {
    // U+0022 QUOTATION MARK (")
    // Consume a string token and return it.
    return consumeStringToken(input, codePoint);
  } else if (codePoint === 0x0023) {
    // U+0023 NUMBER SIGN (#)
    // If the next input code point is an ident code point or the next two input code points are a valid escape, then:
    //   Create a <hash-token>.
    //   If the next 3 input code points would start an ident sequence, set the <hash-token>’s type flag to "id".
    //   Consume an ident sequence, and set the <hash-token>’s value to the returned string.
    //   Return the <hash-token>.
    // Otherwise, return a <delim-token> with its value set to the current input code point.
    if (isIdentCodePoint(lookahead[0]) || validEscape(...lookahead)) {
      const hashToken = new HashToken();
      if (startsIdentSequence(...lookahead)) {
        hashToken.type = 'id';
      }
      hashToken.value = consumeIdentSequence(input);
      return hashToken;
    } else {
      return new DelimToken(String.fromCodePoint(codePoint));
    }
  } else if (codePoint === 0x0027) {
    // U+0027 APOSTROPHE (')
    // Consume a string token and return it.
    return consumeStringToken(input, codePoint);
  } else if (codePoint === 0x0028) {
    // U+0028 LEFT PARENTHESIS (()
    // Return a <(-token>.
    return new LeftParenthesisToken();
  } else if (codePoint === 0x0029) {
    // U+0029 RIGHT PARENTHESIS ())
    // Return a <)-token>.
    return new RightParenthesisToken();
  } else if (codePoint === 0x002B) {
    // U+002B PLUS SIGN (+)
    // If the input stream starts with a number, reconsume the current input code point, consume a numeric token,
    // and return it.
    // Otherwise, return a <delim-token> with its value set to the current input code point.
    if (startsNumber(...lookahead)) {
      input.reconsume(codePoint);
      return consumeNumericToken(input);
    } else {
      return new DelimToken(String.fromCodePoint(codePoint));
    }
  } else if (codePoint === 0x002C) {
    // U+002C COMMA (,)
    // Return a <comma-token>.
    return new CommaToken();
  } else if (codePoint === 0x002D) {
    // U+002D HYPHEN-MINUS (-)
    if (startsNumber(...input.peek())) {
      // If the input stream starts with a number, reconsume the current input code point, consume a numeric token, and return it.
      input.reconsume(codePoint);
      return consumeNumericToken(input);
    } else if (input.peek()[0] === 0x002D && input.peek()[1] === 0x003E) {
      // Otherwise, if the next 2 input code points are U+002D HYPHEN-MINUS U+003E GREATER-THAN SIGN (->), consume them and return a <CDC-token>.
      input.consume();
      input.consume();
      return new CDCToken();
    } else if (startsIdentSequence(...input.peek())) {
      // Otherwise, if the input stream starts with an ident sequence, reconsume the current input code point, consume an ident-like token, and return it.
      input.reconsume(codePoint);
      return consumeIdentLikeToken(input);
    } else {
      // Otherwise, return a <delim-token> with its value set to the current input code point.
      return new DelimToken(String.fromCodePoint(codePoint));
    }
  } else if (codePoint === 0x002E) {
    // U+002E FULL STOP (.)
    if (startsNumber(...input.peek())) {
      // If the input stream starts with a number, reconsume the current input code point, consume a numeric token, and return it.
      input.reconsume(codePoint);
      return consumeNumericToken(input);
    } else {
      // Otherwise, return a <delim-token> with its value set to the current input code point.
      return new DelimToken(String.fromCodePoint(codePoint));
    }
  } else if (codePoint === 0x003A) {
    // U+003A COLON (:)
    // Return a <colon-token>.
    return new ColonToken();
  } else if (codePoint === 0x003B) {
    // U+003B SEMICOLON (;)
    // Return a <semicolon-token>.
    return new SemicolonToken();
  } else if (codePoint === 0x003C) {
    // U+003C LESS-THAN SIGN (<)
    if (lookahead[0] === 0x0021 && lookahead[1] === 0x002D && lookahead[2] === 0x002D) {
      // If the next 3 input code points are U+0021 EXCLAMATION MARK U+002D HYPHEN-MINUS U+002D HYPHEN-MINUS (!--), consume them and return a <CDO-token>.
      input.consume();
      input.consume();
      input.consume();
      return new CDOToken();
    } else {
      // Otherwise, return a <delim-token> with its value set to the current input code point.
      return new DelimToken(String.fromCodePoint(codePoint));
    }
  } else if (codePoint === 0x0040) {
    // U+0040 COMMERCIAL AT (@)
    if (startsIdentSequence(...lookahead)) {
      // If the next 3 input code points would start an ident sequence, consume an ident sequence,
      // create an <at-keyword-token> with its value set to the returned value, and return it.
      return new AtKeywordToken(consumeIdentSequence(input));
    } else {
      // Otherwise, return a <delim-token> with its value set to the current input code point.
      return new DelimToken(String.fromCodePoint(codePoint));
    }
  } else if (codePoint === 0x005B) {
    // U+005B LEFT SQUARE BRACKET ([)
    // Return a <[-token>.
    return new LeftSquareBracketToken();
  } else if (codePoint === 0x005C) {
    // U+005C REVERSE SOLIDUS (\)
    if (validEscape(...lookahead)) {
      // If the input stream starts with a valid escape, reconsume the current input code point, consume an ident-like token, and return it.
      input.reconsume(codePoint);
      return consumeIdentLikeToken(input);
    } else {
      // Otherwise, this is a parse error. Return a <delim-token> with its value set to the current input code point.
      return new DelimToken(String.fromCodePoint(codePoint));
    }
  } else if (codePoint === 0x005D) {
    // U+005D RIGHT SQUARE BRACKET (])
    // Return a <]-token>.
    return new RightSquareBracketToken();
  } else if (codePoint === 0x007B) {
    // U+007B LEFT CURLY BRACKET ({)
    // Return a <{-token>.
    return new LeftCurlyBracketToken();
  } else if (codePoint === 0x007D) {
    // U+007D RIGHT CURLY BRACKET (})
    // Return a <}-token>.
    return new RightCurlyBracketToken();
  } else if (isDigit(codePoint)) {
    // digit
    // Reconsume the current input code point, consume a numeric token, and return it.
    input.reconsume(codePoint);
    return consumeNumericToken(input);
  } else if (isIdentStartCodePoint(codePoint)) {
    // ident-start code point
    // Reconsume the current input code point, consume an ident-like token, and return it.
    input.reconsume(codePoint);
    return consumeIdentLikeToken(input);
  } else if (typeof codePoint === 'undefined') {
    // EOF
    // Return an <EOF-token>.
    return undefined;
  } else {
    // anything else
    // Return a <delim-token> with its value set to the current input code point.
    return new DelimToken(String.fromCodePoint(codePoint));
  }
}

/**
 * Tokenize a string into an array of CSS tokens.
 * @param {string} str
 */
export function tokenizeString(str) {
  const input = new InputStream(str);
  // To tokenize a stream of code points into a stream of CSS tokens input, repeatedly consume a token from input
  // until an <EOF-token> is reached, pushing each of the returned tokens into a stream.
  const tokens = [];
  while (true) {
    const token = consumeToken(input);
    if (typeof token === 'undefined') {
      return tokens;
    } else {
      tokens.push(token);
    }
  }
}