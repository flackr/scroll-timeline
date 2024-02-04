import {simplifyCalculation} from '../simplify-calculation';
import {
  CommaToken,
  DelimToken,
  DimensionToken,
  FunctionToken,
  IdentToken,
  LeftCurlyBracketToken,
  LeftParenthesisToken,
  LeftSquareBracketToken,
  NumberToken,
  PercentageToken,
  RightCurlyBracketToken,
  RightParenthesisToken,
  RightSquareBracketToken,
  WhitespaceToken
} from './tokens';
import {tokenizeString} from './tokenizer';
import {createAType} from './procedures.js';

class CSSFunction {
  name;
  values;

  constructor(name, values) {
    this.name = name;
    this.values = values;
  }
}

class CSSSimpleBlock {
  value;
  associatedToken;

  constructor(value, associatedToken) {
    this.value = value;
    this.associatedToken = associatedToken;
  }
}

/**
 * Normalize into a token stream
 * https://www.w3.org/TR/css-syntax-3/#normalize-into-a-token-stream
 */
function normalizeIntoTokenStream(input) {
  // If input is a list of CSS tokens, return input.
  // If input is a list of CSS component values, return input.
  if (Array.isArray(input)) {
    return input;
  }
  // If input is a string, then filter code points from input, tokenize the result, and return the final result.
  if (typeof input === 'string') {
    return tokenizeString(input);
  }
  // Assert: Only the preceding types should be passed as input.
  throw new TypeError(`Invalid input type ${typeof input}`);
}

/**
 * Consume a function
 * https://www.w3.org/TR/css-syntax-3/#consume-a-function
 * @param {FunctionToken} token
 * @param {Token[]} tokens
 */
function consumeFunction(token, tokens) {
  // Create a function with its name equal to the value of the current input token and with its value initially set to an empty list.
  const func = new CSSFunction(token.value, []);

  // Repeatedly consume the next input token and process it as follows:
  while (true) {
    const nextToken = tokens.shift();
    if (nextToken instanceof RightParenthesisToken) {
      // <)-token>
      // Return the function.
      return func;
    } else if (typeof nextToken === 'undefined') {
      // <EOF-token>
      // This is a parse error. Return the function.
      return func;
    } else {
      // anything else
      // Reconsume the current input token. Consume a component value and append the returned value to the function’s value.
      tokens.unshift(nextToken);
      func.values.push(consumeComponentValue(tokens));
    }
  }
}

/**
 * Consume a simple block
 * https://www.w3.org/TR/css-syntax-3/#consume-simple-block
 * @param {Token[]} tokens
 * @param {LeftCurlyBracketToken | LeftParenthesisToken | LeftSquareBracketToken} currentInputToken
 */
function consumeSimpleBlock(tokens, currentInputToken) {
  // The ending token is the mirror variant of the current input token. (E.g. if it was called with <[-token>, the ending token is <]-token>.)
  let endingTokenConstructor;
  if (currentInputToken instanceof LeftCurlyBracketToken) {
    endingTokenConstructor = RightCurlyBracketToken;
  } else if (currentInputToken instanceof LeftParenthesisToken) {
    endingTokenConstructor = RightParenthesisToken;
  } else if (currentInputToken instanceof LeftSquareBracketToken) {
    endingTokenConstructor = RightSquareBracketToken;
  } else {
    return undefined;
  }


  // Create a simple block with its associated token set to the current input token and with its value initially set to an empty list.
  const simpleBlock = new CSSSimpleBlock([], currentInputToken);

  // Repeatedly consume the next input token and process it as follows:
  while (true) {
    const token = tokens.shift();
    if (token instanceof endingTokenConstructor) {
      // ending token
      // Return the block.
      return simpleBlock;
    } else if (typeof token === 'undefined') {
      // <EOF-token>
      // This is a parse error. Return the block.
      return simpleBlock;
    } else {
      // anything else
      // Reconsume the current input token. Consume a component value and append it to the value of the block.
      tokens.unshift(token);
      simpleBlock.value.push(consumeComponentValue(tokens));
    }
  }
}

/**
 * Consume a component value
 * https://www.w3.org/TR/css-syntax-3/#consume-a-component-value
 * @param {Token[]} tokens
 */
function consumeComponentValue(tokens) {
  const syntaxError = null;
  // Consume the next input token.
  const token = tokens.shift();

  if (token instanceof LeftCurlyBracketToken || token instanceof LeftSquareBracketToken || token instanceof
    LeftParenthesisToken) {
    // If the current input token is a <{-token>, <[-token>, or <(-token>, consume a simple block and return it.
    return consumeSimpleBlock(tokens, token);
  } else if (token instanceof FunctionToken) {
    // Otherwise, if the current input token is a <function-token>, consume a function and return it.
    return consumeFunction(token, tokens);
  } else {
    // Otherwise, return the current input token.
    return token;
  }
}

/**
 * Parse a component value
 * https://www.w3.org/TR/css-syntax-3/#parse-component-value
 * @param {string} input
 */
function parseComponentValue(input) {
  const syntaxError = null;
  // To parse a component value from input:
  // 1. Normalize input, and set input to the result.
  const tokens = normalizeIntoTokenStream(input);

  // 2. While the next input token from input is a <whitespace-token>, consume the next input token from input.
  while (tokens[0] instanceof WhitespaceToken) {
    tokens.shift();
  }
  // 3. If the next input token from input is an <EOF-token>, return a syntax error.
  if (typeof tokens[0] === 'undefined') {
    return syntaxError;
  }
  // 4. Consume a component value from input and let value be the return value.
  const returnValue = consumeComponentValue(tokens);
  // 5. While the next input token from input is a <whitespace-token>, consume the next input token.
  while (tokens[0] instanceof WhitespaceToken) {
    tokens.shift();
  }
  // 6. If the next input token from input is an <EOF-token>, return value. Otherwise, return a syntax error.
  if (typeof tokens[0] === 'undefined') {
    return returnValue;
  } else {
    return syntaxError;
  }
}

function precedence(token) {
  if (token instanceof LeftParenthesisToken || token instanceof RightParenthesisToken) {
    return 6;
  } else if (token instanceof DelimToken) {
    const value = token.value;
    switch (value) {
      case '*':
        return 4;
      case '/':
        return 4;
      case '+':
        return 2;
      case '-':
        return 2;
    }
  }
}

function last(items) {
  return items[items.length - 1];
}

function toNAryAstNode(operatorToken, first, second) {
  // Treat subtraction as instead being addition, with the RHS argument instead wrapped in a special "negate" node.
  // Treat division as instead being multiplication, with the RHS argument instead wrapped in a special "invert" node.

  const type = ['+', '-'].includes(operatorToken.value) ? 'ADDITION' : 'MULTIPLICATION';
  const firstValues = first.type === type ? first.values : [first];
  const secondValues = second.type === type ? second.values : [second];

  if (operatorToken.value === '-') {
    secondValues[0] = {type: 'NEGATE', value: secondValues[0]};
  } else if (operatorToken.value === '/') {
    secondValues[0] = {type: 'INVERT', value: secondValues[0]};
  }
  return {type, values: [...firstValues, ...secondValues]};
}

/**
 * Convert expression to AST using the Shunting Yard Algorithm
 * https://en.wikipedia.org/wiki/Shunting_yard_algorithm
 * @param {(Token | CSSFunction)[]} tokens
 * @return {null}
 */
function convertTokensToAST(tokens) {
  const operatorStack = [];
  const tree = [];
  while (tokens.length) {
    const token = tokens.shift();
    if (token instanceof NumberToken || token instanceof DimensionToken || token instanceof PercentageToken ||
      token instanceof CSSFunction || token instanceof CSSSimpleBlock || token instanceof IdentToken) {
      tree.push(token);
    } else if (token instanceof DelimToken && ['*', '/', '+', '-'].includes(token.value)) {
      while (operatorStack.length &&
      !(last(operatorStack) instanceof LeftParenthesisToken) &&
      precedence(last(operatorStack)) > precedence(token)) {
        const o2 = operatorStack.pop();
        const second = tree.pop();
        const first = tree.pop();
        tree.push(toNAryAstNode(o2, first, second));
      }
      operatorStack.push(token);
    } else if (token instanceof LeftParenthesisToken) {
      operatorStack.push(token);
    } else if (token instanceof RightParenthesisToken) {
      if (!operatorStack.length) {
        return null;
      }
      while (!(last(operatorStack) instanceof LeftParenthesisToken)) {
        const o2 = operatorStack.pop();
        const second = tree.pop();
        const first = tree.pop();
        tree.push(toNAryAstNode(o2, first, second));
      }
      if (!(last(operatorStack) instanceof LeftParenthesisToken)) {
        return null;
      }
      operatorStack.pop();
    } else if (token instanceof WhitespaceToken) {
      // Consume token
    } else {
      return null;
    }
  }
  while (operatorStack.length) {
    if (last(operatorStack) instanceof LeftParenthesisToken) {
      return null;
    }
    const o2 = operatorStack.pop();
    const second = tree.pop();
    const first = tree.pop();
    tree.push(toNAryAstNode(o2, first, second));
  }
  return tree[0];
}

/**
 * Step 4 of `reify a math expression`
 * https://drafts.css-houdini.org/css-typed-om/#reify-a-math-expression
 *
 * 4. Recursively transform the expression tree into objects, as follows:
 *
 * @param {ASTNode} node
 * @return {CSSMathNegate|CSSMathProduct|CSSMathMin|CSSMathMax|CSSMathSum|CSSNumericValue|CSSUnitValue|CSSMathInvert}
 */
function transformToCSSNumericValue(node) {
  if (node.type === 'ADDITION') {
    // addition node
    // becomes a new CSSMathSum object, with its values internal slot set to its list of arguments
    return new CSSMathSum(...node.values.map(value => transformToCSSNumericValue(value)));
  } else if (node.type === 'MULTIPLICATION') {
    // multiplication node
    // becomes a new CSSMathProduct object, with its values internal slot set to its list of arguments
    return new CSSMathProduct(...node.values.map(value => transformToCSSNumericValue(value)));
  } else if (node.type === 'NEGATE') {
    // negate node
    // becomes a new CSSMathNegate object, with its value internal slot set to its argument
    return new CSSMathNegate(transformToCSSNumericValue(node.value));
  } else if (node.type === 'INVERT') {
    // invert node
    // becomes a new CSSMathInvert object, with its value internal slot set to its argument
    return new CSSMathInvert(transformToCSSNumericValue(node.value));
  } else {
    // leaf node
    // reified as appropriate
    if (node instanceof CSSSimpleBlock) {
      return reifyMathExpression(new CSSFunction('calc', node.value));
    } else if (node instanceof IdentToken) {
      if (node.value === 'e') {
        return new CSSUnitValue(Math.E, 'number');
      } else if (node.value === 'pi') {
        return new CSSUnitValue(Math.PI, 'number');
      } else {
        throw new SyntaxError('Invalid math expression');
      }
    } else {
      return reifyNumericValue(node);
    }
  }
}

/**
 * Reify a math expression
 * https://drafts.css-houdini.org/css-typed-om/#reify-a-math-expression
 * @param {CSSFunction} num
 */
function reifyMathExpression(num) {
  // TODO: handle `clamp()` and possibly other math functions
  // 1. If num is a min() or max() expression:
  if (num.name === 'min' || num.name === 'max') {
    // Let values be the result of reifying the arguments to the expression, treating each argument as if it were the contents of a calc() expression.
    const values = num.values
      .filter(value => !(value instanceof WhitespaceToken || value instanceof CommaToken))
      // TODO: Update when we have clarification on where simplify a calculation should be run:
      // https://github.com/w3c/csswg-drafts/issues/9870
      .map(value => simplifyCalculation(reifyMathExpression(new CSSFunction('calc', value))));
    // Return a new CSSMathMin or CSSMathMax object, respectively, with its values internal slot set to values.
    return num.name === 'min' ? new CSSMathMin(...values) : new CSSMathMax(...values);
  }

  // 2. Assert: Otherwise, num is a calc().
  if (num.name !== 'calc') {
    return null;
  }

  // 3. Turn num’s argument into an expression tree using standard PEMDAS precedence rules, with the following exceptions/clarification:
  //
  // Treat subtraction as instead being addition, with the RHS argument instead wrapped in a special "negate" node.
  // Treat division as instead being multiplication, with the RHS argument instead wrapped in a special "invert" node.
  // Addition and multiplication are N-ary; each node can have any number of arguments.
  // If an expression has only a single value in it, and no operation, treat it as an addition node with the single argument.
  const root = convertTokensToAST([...num.values]);

  // 4. Recursively transform the expression tree into objects
  const numericValue = transformToCSSNumericValue(root);
  let simplifiedValue;
  try {
    // TODO: Update when we have clarification on where simplify a calculation should be run:
    // https://github.com/w3c/csswg-drafts/issues/9870
    simplifiedValue = simplifyCalculation(numericValue);
  } catch (e) {
    // Use insertRule to trigger native SyntaxError on TypeError
    (new CSSStyleSheet()).insertRule('error', 0);
  }
  if (simplifiedValue instanceof CSSUnitValue) {
    return new CSSMathSum(simplifiedValue);
  } else {
    return simplifiedValue;
  }
}

/**
 * Reify a numeric value
 * https://drafts.css-houdini.org/css-typed-om/#reify-a-numeric-value
 * @param num
 */
function reifyNumericValue(num) {
  // If an internal representation contains a var() reference, then it is reified by reifying a list of component values,
  // regardless of what property it is for.
  // TODO: handle `var()` function

  // If num is a math function, reify a math expression from num and return the result.
  if (num instanceof CSSFunction && ['calc', 'min', 'max', 'clamp'].includes(num.name)) {
    return reifyMathExpression(num);
  }
  // If num is the unitless value 0 and num is a <dimension>,
  // return a new CSSUnitValue with its value internal slot set to 0, and its unit internal slot set to "px".
  if (num instanceof NumberToken && num.value === 0 && !num.unit) {
    return new CSSUnitValue(0, 'px');
  }
  // Return a new CSSUnitValue with its value internal slot set to the numeric value of num, and its unit internal slot
  // set to "number" if num is a <number>, "percent" if num is a <percentage>, and num’s unit if num is a <dimension>.
  if (num instanceof NumberToken) {
    return new CSSUnitValue(num.value, 'number');
  } else if (num instanceof PercentageToken) {
    return new CSSUnitValue(num.value, 'percent');
  } else if (num instanceof DimensionToken) {
    return new CSSUnitValue(num.value, num.unit);
  }
}

/**
 * Implementation of the parse(cssText) method.
 * https://drafts.css-houdini.org/css-typed-om-1/#dom-cssnumericvalue-parse
 * @param {string} cssText
 * @return {CSSMathMin|CSSMathMax|CSSMathSum|CSSMathProduct|CSSMathNegate|CSSMathInvert|CSSUnitValue}
 */
export function parseCSSNumericValue(cssText) {
  // Parse a component value from cssText and let result be the result.
  // If result is a syntax error, throw a SyntaxError and abort this algorithm.
  const result = parseComponentValue(cssText);
  if (result === null) {
    // Use insertRule to trigger native SyntaxError
    (new CSSStyleSheet()).insertRule('error', 0);
  }
  // If result is not a <number-token>, <percentage-token>, <dimension-token>, or a math function, throw a SyntaxError and abort this algorithm.
  if (!(result instanceof NumberToken || result instanceof PercentageToken || result instanceof DimensionToken ||
    result instanceof CSSFunction)) {
    // Use insertRule to trigger native SyntaxError
    (new CSSStyleSheet()).insertRule('error', 0);
  }
  // If result is a <dimension-token> and creating a type from result’s unit returns failure, throw a SyntaxError and abort this algorithm.
  if (result instanceof DimensionToken) {
    const type = createAType(result.unit);
    if (type === null) {
      // Use insertRule to trigger native SyntaxError
      (new CSSStyleSheet()).insertRule('error', 0);
    }
  }
  // Reify a numeric value result, and return the result.
  return reifyNumericValue(result);
}