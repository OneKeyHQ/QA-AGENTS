const constStr = {
  password: 'PASSWORD',
  hasWallet: 'HAS_WALLET',
};

export const get = async key => {
  const value = await browser.sharedStore.get(key);
  console.log(`>>>>>>>>>>>>> globalStore.get.${key}`, JSON.stringify(value));

  return value;
};
export const set = async (key, value) => {
  await browser.sharedStore.set(key, value);
  console.log(`>>>>>>>>>>>>> globalStore.set.${key}`, value);
};

export const del = async key => {
  await browser.sharedStore.set(key, undefined);
  console.log(`>>>>>>>>>>>>> globalStore.del.${key}`);
};
export const clear = async () => {
  const kv = await browser.sharedStore.get('*');
  const keys = Object.keys(kv);
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    await del(key);
  }
};

export const updatePerfData = async (mainField, x, y) => {
  const key = `perf:${mainField}`;

  const currentList = await browser.sharedStore.get(key);
  const newList = Array.from(currentList || []).concat([{ x, y }]);
  await browser.sharedStore.set(key, newList);
};
export const updateRRWebEvent = async (mainField, x, y) => {
  const key = `RR_WEB_EVENT:${mainField}`;
  const currentList = await browser.sharedStore.get(key);
  const newList = Array.from(currentList || []).concat([{ x, y }]);
  await browser.sharedStore.set(key, newList);
};

export const getRRWebEvent = async (mainField, x, y) => {
  const key = `RR_WEB_EVENT:${mainField}`;
  const currentList = await browser.sharedStore.get(key);
  return currentList;
};

export default {
  clear,
  get,
  set,
  del,
  updatePerfData,
  updateRRWebEvent,
  getRRWebEvent,
  constStr,
};
