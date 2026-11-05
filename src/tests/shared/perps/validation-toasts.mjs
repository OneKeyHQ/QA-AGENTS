// Operate only local transient notifications; never accepts financial actions.
export function dismissCurrentValidationToasts(nodes) {
  let closed=0;
  for(const e of nodes){
    if(!e.isConnected||e.dataset.removed==='true')continue;
    const close=e.querySelector('button[data-close-button="true"]');
    if(!close)throw Error('Active validation toast has no close control');
    close.click();closed++;
  }return closed;
}

export const activeToasts = page => page.getByRole('status').and(page.locator(':not([data-removed="true"])'));
