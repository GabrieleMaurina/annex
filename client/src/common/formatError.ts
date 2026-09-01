export function formatError(message: string): string {
  if (!message) return message;
  return `${message[0].toUpperCase()}${message.slice(1)}.`;
}
