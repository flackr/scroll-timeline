
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
