import { detectPlatform } from '../utils/detectPlatform.js';

const getText = async (element, input = true, platform = detectPlatform()) => {
  const resolvedElement = await element;

  if (!resolvedElement) {
    throw new TypeError('api.getText: element is null or undefined');
  }

  if (!input) {
    if (typeof resolvedElement.getText !== 'function') {
      throw new TypeError(
        'api.getText: resolved element does not support getText()',
      );
    }
    return resolvedElement.getText();
  }

  if (typeof resolvedElement.getValue !== 'function') {
    throw new TypeError(
      'api.getText: resolved element does not support getValue()',
    );
  }

  return resolvedElement.getValue();
};

export default getText;
