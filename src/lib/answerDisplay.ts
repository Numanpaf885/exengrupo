/**
 * Display-only tweaks of the saved answer line, so line breaks fall between
 * answers: keep "3.b/c ?" together and a number with its unit ("100 °C",
 * "25 %", "9,8 m/s²"). The saved text keeps the exact format.
 */
export function displayAnswer(line: string): string {
  return line.replace(/ \?/g, ' ?').replace(/(\d) (?=(?:°[CFK]?|%|[a-zA-Zµ]{1,3}(?:\/[a-zA-Z]{1,3})?[²³]?)(?:[\s.,;)]|$))/g, '$1 ');
}
