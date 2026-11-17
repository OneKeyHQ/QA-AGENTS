// Escape dismissal commits asynchronously. A detached backdrop after a close
// is success only when the independently checked overlay is actually absent.
export async function closeLocalOverlay({isOpen, escape, waitHidden, clickBackdrop}) {
  if (!(await isOpen())) return;
  await escape();
  try { await waitHidden(500); return; } catch (error) {
    if (!(await isOpen())) return;
  }
  try { await clickBackdrop(); } catch (error) {
    if (await isOpen()) throw error;
  }
  await waitHidden(5000);
}
