import fs from 'node:fs';
import { api } from '@node-e2e/cli/api/index.js';

describe('image diff ', () => {
  it('diff screenshot ', async () => {
    await api.pause(500);
    await api.tap($(api.by.id('me')));
    await api.tap($(api.by.id('tabme-settings')));
    await api.tap($(api.by.id('setting-preference-language')));
    await api.tap($(api.by.id('settinglanguagemodal-system')));
    await api.tap($(api.by.id('nav-header-close')));
    await api.pause(1000);
    const res = await driver.compareScreen('setting-current-lan');
    if (res.misMatchPercentage > 0) {
      api.reporter.addAttachment(
        'Baseline Image',
        fs.readFileSync(`${res.folders.baseline}/${res.fileName}`),
        'image/png',
      );
      api.reporter.addAttachment(
        'Diff Image',
        fs.readFileSync(`${res.folders.diff}/${res.fileName}`),
        'image/png',
      );
    }

    await expect(res.misMatchPercentage).toEqual(0);
  });
});
