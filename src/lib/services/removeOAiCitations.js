export function stripOpenAICitations(input) {
  return (
    String(input)
      // 1) File/Web citations e.g.,
      .replace(/【[^】]*†[^】]*】/g, "")
      // 2) Private-use widgets e.g.,  / navlist…
      .replace(/[^]*/g, "")
      // 3) (Optional) any leftover full-width bracket tokens
      .replace(/【[^】]*】/g, "")
      // 4) Tidy whitespace
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/ +([.,;:!?])/g, "$1")
      .trim()
  );
}
