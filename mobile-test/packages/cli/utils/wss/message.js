export function parse(message) {
  try {
    return JSON.parse(message);
  } catch (error) {
    console.error('Error parsing message:', error);
    return null;
  }
}

export function build(id, data = null, error = null) {
  return JSON.stringify({ id, data, error });
}
