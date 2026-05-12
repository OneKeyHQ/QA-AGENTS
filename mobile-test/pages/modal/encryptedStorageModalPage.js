import { api } from '@node-e2e/cli/api/index.js';

import Popover from './popover.js';

class EncryptedStorageModal extends Popover {
  get encryptedStorageConfirm() {
    return api.by.id('encrypted-storage-confirm');
  }
  async clickConfirm() {
    await api.tap(this.encryptedStorageConfirm);
  }
}

export const encryptedStorageModal = new EncryptedStorageModal();
