export function parseLength(str) {
  return str.trim().match(/^(-?[0-9]*\.?[0-9]*)(px|%)$/);
}