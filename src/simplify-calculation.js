import {isCanonical} from "./utils";

/**
 * @typedef {{percentageReference: CSSUnitValue, fontSize?: CSSUnitValue}} Info
 */

/**
 * Groups a list of objects by a given string keyed property
 *
 * @template T
 * @param {T[]} items
 * @param {string} key string key
 * @return {Map<any,T[]>}
 */
function groupBy(items, key) {
  return items.reduce((groups, item) => {
    if (groups.has(item[key])) {
      groups.get(item[key]).push(item);
    } else {
      groups.set(item[key], [item]);
    }
    return groups;
  }, new Map());
}

/**
 * Partitions a list into a tuple of lists.
 * The first item in the tuple contains a list of items that pass the test provided by the callback function.
 * The second item in the tuple contains the remaining items
 *
 * @template T
 * @param {T[]} items
 * @param {(item:T) => boolean} callbackFn Returns truthy if item should be put in the first list in the tuple, falsy if it should be put in the second list.
 * @return {[T[],T[]]}
 */
function partition(items, callbackFn) {
  const partA = [];
  const partB = [];
  for (const item of items) {
    if (callbackFn(item)) {
      partA.push(item);
    } else {
      partB.push(item);
    }
  }
  return [partA, partB];
}

/**
 * Partial implementation of `simplify a calculation tree` applied to CSSNumericValue
 * https://www.w3.org/TR/css-values-4/#simplify-a-calculation-tree
 *
 * @param {CSSNumericValue} root
 * @param {Info} info information used to resolve
 * @return {CSSNumericValue}
 */
export function simplifyCalculation(root, info = {}) {
  function simplifyNumericArray(values) {
    return Array.from(values).map((value) => simplifyCalculation(value, info));
  }

  // To simplify a calculation tree root:
  if (root instanceof CSSUnitValue) {
    // 1. If root is a numeric value:

    if (root.unit === "percent" && info.percentageReference) {
      // 1. If root is a percentage that will be resolved against another value, and there is enough information
      //    available to resolve it, do so, and express the resulting numeric value in the appropriate canonical unit.
      //    Return the value.
      const resolvedValue = (root.value / 100) * info.percentageReference.value;
      const resolvedUnit = info.percentageReference.unit;
      return new CSSUnitValue(resolvedValue, resolvedUnit);
    }

    // 2. If root is a dimension that is not expressed in its canonical unit, and there is enough information available
    //    to convert it to the canonical unit, do so, and return the value.

    // Use Typed OM toSum() to convert values in compatible sets to canonical units
    const sum = root.toSum();
    if (sum && sum.values.length === 1) {
      root = sum.values[0];
    }
    // TODO: handle relative lengths
    if (root instanceof CSSUnitValue && root.unit === 'em' && info.fontSize) {
      root = new CSSUnitValue(root.value * info.fontSize.value, info.fontSize.unit);
    }
    // 3. If root is a <calc-keyword> that can be resolved, return what it resolves to, simplified.
    if (root instanceof CSSKeywordValue) {
      //https://www.w3.org/TR/css-values-4/#calc-constants
      if (root.value === 'e') {
        return new CSSUnitValue(Math.E, 'number');
      } else if (root.value === 'pi') {
        return new CSSUnitValue(Math.PI, 'number');
      }
    }
    // 4. Otherwise, return root.
    return root;
  }

  // 2. If root is any other leaf node (not an operator node):
  if (!root.operator) {
    //    1. If there is enough information available to determine its numeric value, return its value, expressed in the value’s canonical unit.
    //    2. Otherwise, return root.
    return root;
  }

  // 3. At this point, root is an operator node. Simplify all the calculation children of root.
  switch (root.operator) {
    case "sum":
      root = new CSSMathSum(...simplifyNumericArray(root.values));
      break;
    case "product":
      root = new CSSMathProduct(...simplifyNumericArray(root.values));
      break;
    case "negate":
      root = new CSSMathNegate(simplifyCalculation(root.value, info));
      break;
    case "clamp":
      root = new CSSMathClamp(simplifyCalculation(root.lower, info), simplifyCalculation(root.value, info),
        simplifyCalculation(root.upper, info));
      break;
    case "invert":
      root = new CSSMathInvert(simplifyCalculation(root.value, info));
      break;
    case "min":
      root = new CSSMathMin(...simplifyNumericArray(root.values));
      break;
    case "max":
      root = new CSSMathMax(...simplifyNumericArray(root.values));
      break;
  }

  // 4. If root is an operator node that’s not one of the calc-operator nodes, and all of its calculation children are
  //    numeric values with enough information to compute the operation root represents, return the result of running
  //    root’s operation using its children, expressed in the result’s canonical unit.
  if (root instanceof CSSMathMin || root instanceof CSSMathMax) {
    const children = Array.from(root.values);
    if (children.every(
      (child) => child instanceof CSSUnitValue && child.unit !== "percent" && isCanonical(child.unit) && child.unit ===
        children[0].unit)) {

      const result = Math[root.operator].apply(Math, children.map(({value}) => value));
      return new CSSUnitValue(result, children[0].unit);
    }
  }

  //    Note: If a percentage is left at this point, it will usually block simplification of the node, since it needs to be
  //    resolved against another value using information not currently available. (Otherwise, it would have been converted
  //    to a different value in an earlier step.) This includes operations such as "min", since percentages might resolve
  //    against a negative basis, and thus end up with an opposite comparative relationship than the raw percentage value
  //    would seem to indicate.
  //
  //    However, "raw" percentages—ones which do not resolve against another value, such as in opacity—might not block
  //    simplification.

  // 5. If root is a Min or Max node, attempt to partially simplify it:
  if (root instanceof CSSMathMin || root instanceof CSSMathMax) {
    const children = Array.from(root.values);
    const [numeric, rest] = partition(children, (child) => child instanceof CSSUnitValue && child.unit !== "percent");
    const unitGroups = Array.from(groupBy(numeric, "unit").values());
    //    1. For each node child of root’s children:
    //
    //       If child is a numeric value with enough information to compare magnitudes with another child of the same
    //       unit (see note in previous step), and there are other children of root that are numeric children with the same
    //       unit, combine all such children with the appropriate operator per root, and replace child with the result,
    //       removing all other child nodes involved.
    const hasComparableChildren = unitGroups.some(group => group.length > 0);
    if (hasComparableChildren) {
      const combinedGroups = unitGroups.map(group => {
        const result = Math[root.operator].apply(Math, group.map(({value}) => value));
        return new CSSUnitValue(result, group[0].unit);
      });
      if (root instanceof CSSMathMin) {
        root = new CSSMathMin(...combinedGroups, ...rest);
      } else {
        root = new CSSMathMax(...combinedGroups, ...rest);
      }
    }

    //    2. If root has only one child, return the child.
    //
    //       Otherwise, return root.
    if (children.length === 1) {
      return children[0];
    } else {
      return root;
    }
  }

  // If root is a Negate node:
  //
  // If root’s child is a numeric value, return an equivalent numeric value, but with the value negated (0 - value).
  // If root’s child is a Negate node, return the child’s child.
  // Return root.
  if (root instanceof CSSMathNegate) {
    if (root.value instanceof CSSUnitValue) {
      return new CSSUnitValue(0 - root.value.value, root.value.unit);
    } else if (root.value instanceof CSSMathNegate) {
      return root.value.value;
    } else {
      return root;
    }
  }

  // If root is an Invert node:
  //
  // If root’s child is a number (not a percentage or dimension) return the reciprocal of the child’s value.
  // If root’s child is an Invert node, return the child’s child.
  // Return root.
  if (root instanceof CSSMathInvert) {
    if (root.value instanceof CSSMathInvert) {
      return root.value.value;
    } else {
      return root;
    }
  }

  // If root is a Sum node:
  if (root instanceof CSSMathSum) {
    let children = [];
    // For each of root’s children that are Sum nodes, replace them with their children.
    for (const value of root.values) {
      if (value instanceof CSSMathSum) {
        children.push(...value.values);
      } else {
        children.push(value);
      }
    }

    // For each set of root’s children that are numeric values with identical units, remove those children and
    // replace them with a single numeric value containing the sum of the removed nodes, and with the same unit.
    //
    // (E.g. combine numbers, combine percentages, combine px values, etc.)
    function sumValuesWithSameUnit(values) {
      const numericValues = values.filter((c) => c instanceof CSSUnitValue);
      const nonNumericValues = values.filter((c) => !(c instanceof CSSUnitValue));

      const summedNumericValues = Array.from(groupBy(numericValues, "unit").entries())
        .map(([unit, values]) => {
          const sum = values.reduce((a, {value}) => a + value, 0);
          return new CSSUnitValue(sum, unit);
        });
      return [...nonNumericValues, ...summedNumericValues];
    }

    children = sumValuesWithSameUnit(children);

    // If root has only a single child at this point, return the child. Otherwise, return root.
    // NOTE: Zero-valued terms cannot be simply removed from a Sum; they can only be combined with other values
    // that have identical units. (This is because the mere presence of a unit, even with a zero value,
    // can sometimes imply a change in behavior.)
    if (children.length === 1) {
      return children[0];
    } else {
      return new CSSMathSum(...children);
    }
  }

  // If root is a Product node:
  //
  // For each of root’s children that are Product nodes, replace them with their children.
  if (root instanceof CSSMathProduct) {
    let children = [];
    for (const value of root.values) {
      if (value instanceof CSSMathProduct) {
        children.push(...value.values);
      } else {
        children.push(value);
      }
    }

    // If root has multiple children that are numbers (not percentages or dimensions), remove them and replace them with
    // a single number containing the product of the removed nodes.
    const [numbers, rest] = partition(children, (child) => child instanceof CSSUnitValue && child.unit === "number");
    if (numbers.length > 1) {
      const product = numbers.reduce((a, {value}) => a * value, 1);
      children = [new CSSUnitValue(product, "number"), ...rest];
    }

    // If root contains only two children, one of which is a number (not a percentage or dimension) and the other of
    // which is a Sum whose children are all numeric values, multiply all of the Sum’s children by the number,
    // then return the Sum.
    if (children.length === 2) {
      let numeric, sum;
      for (const child of children) {
        if (child instanceof CSSUnitValue && child.unit === "number") {
          numeric = child;
        } else if (child instanceof CSSMathSum && [...child.values].every((c) => c instanceof CSSUnitValue)) {
          sum = child;
        }
      }
      if (numeric && sum) {
        return new CSSMathSum(
          ...[...sum.values].map((value) => new CSSUnitValue(value.value * numeric.value, value.unit)));
      }
    }

    // If root contains only numeric values and/or Invert nodes containing numeric values, and multiplying the types of
    // all the children (noting that the type of an Invert node is the inverse of its child’s type) results in a type
    // that matches any of the types that a math function can resolve to, return the result of multiplying all the values
    // of the children (noting that the value of an Invert node is the reciprocal of its child’s value),
    // expressed in the result’s canonical unit.
    if (children.every((child) => (child instanceof CSSUnitValue && isCanonical(child.unit)) ||
      (child instanceof CSSMathInvert && child.value instanceof CSSUnitValue && isCanonical(child.value.unit)))) {
      // Use CSS Typed OM to multiply types
      const sum = new CSSMathProduct(...children).toSum();
      if (sum && sum.values.length === 1) {
        return sum.values[0];
      }
    }

    // Return root.
    return new CSSMathProduct(...children);
  }
  // Return root.
  return root;
}
