export function splitMessage(message: string, maxLength: number): string[] {
  if (message.length <= maxLength) {
    return [message];
  }

  const chunks: string[] = [];
  let currentPosition = 0;

  while (currentPosition < message.length) {
    let endPosition = Math.min(currentPosition + maxLength, message.length);

    if (endPosition < message.length) {
      const lastNewline = message.lastIndexOf('\n', endPosition);
      if (lastNewline > currentPosition) {
        endPosition = lastNewline;
      } else {
        const lastSpace = message.lastIndexOf(' ', endPosition);
        if (lastSpace > currentPosition) {
          endPosition = lastSpace;
        }
      }
    }

    const chunk = message.substring(currentPosition, endPosition).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    currentPosition = endPosition + 1;
  }
  return chunks;
}
