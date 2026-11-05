// A separate target read is mandatory: a source-list diff cannot prove sync.
export function assertFavoriteSync(expected, actual) {
  if (
    !Array.isArray(actual) ||
    actual.length !== expected.length ||
    actual.some((token, index) => token !== expected[index])
  ) {
    throw Error(
      `Favorite target mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

export async function waitForFavoriteSync(
  readTarget,
  expected,
  { timeout = 5000, interval = 100 } = {},
) {
  const deadline = Date.now() + timeout;
  let actual;
  do {
    actual = await readTarget();
    try {
      assertFavoriteSync(expected, actual);
      return actual;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  } while (true);
}
