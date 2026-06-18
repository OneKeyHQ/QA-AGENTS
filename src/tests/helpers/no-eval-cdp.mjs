// CDP Runtime evaluation fallback for extension pages hardened with SES no-eval.

const PATCH_KEY = Symbol.for('onekey.noEvalSafeEvaluate');
const SESSION_KEY = Symbol.for('onekey.noEvalSafeEvaluate.session');

function serializeArg(arg) {
  if (arg === undefined) return '';
  return JSON.stringify(arg);
}

function formatException(details) {
  if (!details) return 'unknown CDP Runtime.evaluate error';
  return details.exception?.description || details.exception?.value || details.text || JSON.stringify(details);
}

function buildExpression(pageFunction, arg) {
  if (typeof pageFunction === 'function') {
    const source = pageFunction.toString();
    const serialized = serializeArg(arg);
    return serialized ? `(${source})(${serialized})` : `(${source})()`;
  }
  return String(pageFunction);
}

async function evaluateWithCdp(session, pageFunction, arg) {
  const response = await session.send('Runtime.evaluate', {
    expression: buildExpression(pageFunction, arg),
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (response.exceptionDetails) {
    throw new Error(`cdp evaluate failed: ${formatException(response.exceptionDetails)}`);
  }
  return response.result?.value;
}

function createValueHandle(value) {
  return {
    async jsonValue() {
      return value;
    },
    asElement() {
      return null;
    },
    async dispose() {},
    toString() {
      return `JSHandle@${value === null ? 'null' : typeof value}`;
    },
    valueOf() {
      return value;
    },
    [Symbol.toPrimitive]() {
      return value;
    },
  };
}

async function getOrCreateSession(page) {
  if (page[SESSION_KEY]) return page[SESSION_KEY];
  const session = await page.context().newCDPSession(page);
  Object.defineProperty(page, SESSION_KEY, { value: session, configurable: true });
  return session;
}

function normalizeWaitArgs(argOrOptions, maybeOptions) {
  if (maybeOptions !== undefined) {
    return { arg: argOrOptions, options: maybeOptions || {} };
  }
  const value = argOrOptions;
  const looksLikeOptions = value && typeof value === 'object' && (
    Object.hasOwn(value, 'timeout') ||
    Object.hasOwn(value, 'polling')
  );
  return looksLikeOptions ? { arg: undefined, options: value } : { arg: value, options: {} };
}

/**
 * Patch page.evaluate/page.waitForFunction to use raw CDP Runtime.evaluate.
 *
 * Newer OneKey extension builds run SES with evalTaming=no-eval, which blocks
 * Playwright's injected utility script even though the extension page is present.
 * waitForFunction returns a small JSHandle-compatible wrapper around the value.
 */
export async function installNoEvalSafeEvaluate(page) {
  if (!page) return false;

  const url = typeof page.url === 'function' ? page.url() : '';
  if (!url.startsWith('chrome-extension://')) return false;

  const session = await getOrCreateSession(page);
  page.evaluate = async (pageFunction, arg) => evaluateWithCdp(session, pageFunction, arg);
  page.waitForFunction = async (pageFunction, argOrOptions, maybeOptions) => {
    const { arg, options } = normalizeWaitArgs(argOrOptions, maybeOptions);
    const timeout = Number(options.timeout ?? 30_000);
    const polling = typeof options.polling === 'number' ? Math.max(25, options.polling) : 100;
    const startedAt = Date.now();
    let lastError = null;

    while (Date.now() - startedAt < timeout) {
      try {
        const value = await evaluateWithCdp(session, pageFunction, arg);
        if (value) return createValueHandle(value);
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, polling));
    }

    const suffix = lastError ? ` Last error: ${lastError.message}` : '';
    throw new Error(`cdp waitForFunction timeout ${timeout}ms.${suffix}`);
  };

  if (!page[PATCH_KEY]) {
    Object.defineProperty(page, PATCH_KEY, { value: true, configurable: true });
  }
  return true;
}
