/***
 * @description timestamp to format date
 * @param {number} timestamp
 * @param {string} format
 * @param {boolean} padZero
 * @return {string} formatted date
 */
export const timeFormatter = (
  timestamp,
  format = 'yy-mm-dd hh:mi:ss',
  padZero = true,
) => {
  if (typeof timestamp !== 'number' && typeof timestamp !== 'string') {
    throw new Error('Invalid params: timestamp');
  }
  const date = new Date(timestamp > 10000000000 ? timestamp : timestamp * 1000);
  const pad = num => (padZero && num < 10 ? '0' + num : num);
  const replacements = {
    yy: date.getFullYear(),
    mm: pad(date.getMonth() + 1),
    dd: pad(date.getDate()),
    hh: pad(date.getHours()),
    mi: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
  };

  return format.replace(
    /yyyy|yy|mm|dd|hh|mi|ss/g,
    match => replacements[match],
  );
};
