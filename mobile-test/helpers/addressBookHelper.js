import { api } from '@node-e2e/cli/api/index.js';
import {
  onboardingPage,
  setPasswordPage,
  addressBookPageNoAddress,
  addressBookAddAddressPage,
  scanPage,
  networkSelectorModal,
} from '../pages/index.js';
import util from '../util/index.js';

class AddressBookHelperClass {
  static async prepareAddressBook(data) {
    await util.forEachAsync(data, async parameter => {
      await AddressBookHelper.addAddressFromAddIconBtnWithExpect({
        name: parameter.name,
        address: parameter.address,
        chain: parameter.chain,
        chainId: parameter.chainId,
      });
    })();
  }
  static async addAddressFromAddIconBtnWithExpect({
    name,
    address,
    domain,
    chainId,
  }) {
    await addressBookPageNoAddress.clickAddIconBtn();
    await addressBookAddAddressPage.waitEntryPage();
    if (chainId) {
      await addressBookAddAddressPage.clickSelectChain();
      await networkSelectorModal.waitEntryPage();
      await networkSelectorModal.selectNetworkById(chainId);
    }
    await addressBookAddAddressPage.save({
      name: name,
      address: domain || address,
    });
    await addressBookPageNoAddress.waitEntryPage();
    await addressBookPageNoAddress.expectAddressInfoExist({
      name: name,
      address: address,
    });
  }

  static async deleteAddressByAddressWithExpect(address) {
    await addressBookPageNoAddress.clickItemMenuByAddress(address);
    await addressBookPageNoAddress.clickItemEditByAddress(address);
    await addressBookAddAddressPage.clickRemoveBtn();
    await addressBookAddAddressPage.clickRemoveConfirmBtn();
    await addressBookPageNoAddress.waitEntryPage();
    await addressBookPageNoAddress.expectAddressNotExist(address);
  }
  static async deleteAddressesInAddressBookWithExpect(data, addresses) {
    await AddressBookHelper.deleteAddressesWithExpect(addresses);
    const addressLeft = data
      .filter(o => !addresses.includes(o.address))
      .map(x => x.address);
    await AddressBookHelper.expectAddressesExist(addressLeft);
  }

  static async deleteAddressesWithExpect(addresses) {
    await util.forEachAsync(addresses, async address => {
      await AddressBookHelper.deleteAddressByAddressWithExpect(address);
    })();
  }

  static async editAddressInfo(addressInfoFrom, addressInfoTo) {
    await addressBookPageNoAddress.clickItemMenuByAddress(addressInfoFrom.address);
    await addressBookPageNoAddress.clickItemEditByAddress(addressInfoFrom.address);

    await addressBookAddAddressPage.save({
      address: addressInfoTo.address,
      name: addressInfoTo.name,
      chainId: addressInfoTo.chainId,
    });

    await addressBookPageNoAddress.waitEntryPage();
    await api.pause(6000); // data load
    await addressBookPageNoAddress.expectAddressInfoExist({
      address: addressInfoTo.address,
      name: addressInfoTo.name,
      chainId: addressInfoTo.chainId,
    });
    await addressBookPageNoAddress.expectAddressNotExist(addressInfoFrom.address);
  }

  static async clipAddressByAddressWithExpect(address) {
    await addressBookPageNoAddress.clickItemMenuByAddress(address);
    await addressBookPageNoAddress.clickItemCopyByAddress(address);
    await addressBookPageNoAddress.expectClipboardEqualAddress(address);
  }

  static async expectAddressesExist(addresses) {
    await util.forEachAsync(addresses, async address => {
      await addressBookPageNoAddress.expectAddressExist(address);
    });
  }
}

export const AddressBookHelper = AddressBookHelperClass;
