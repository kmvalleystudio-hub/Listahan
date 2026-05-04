/** First letter of each whitespace-separated word uppercased; remaining letters lowercased. */
export function toTitleCaseWords(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
