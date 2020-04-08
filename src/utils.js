export function parseLength(str) {
  let matches = str.trim().match(/^(-?[0-9]*\.?[0-9]*)(px|%)$/);
  if( matches ) {
    return {
      value: matches[1],
      unit: matches[2],
    }
  }
  return null
}