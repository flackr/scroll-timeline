export function parseLength(obj) {
  if (obj instanceof CSSUnitValue)
    return obj;
  let matches = obj.trim().match(/^(-?[0-9]*\.?[0-9]*)(px|%)$/);
  if (matches) {
    let value = matches[1];
    // The unit for % is percent.
    let unit = matches[2] == '%' ? 'percent' : matches[2];
    return new CSSUnitValue(value, unit);
  }
  return null;
}
