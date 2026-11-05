// Share an in-flight/public catalog, but never retain a rejected read as the
// permanent result for all later steps. The original step still fails.
export function readCachedCatalog(cache,page,load) {
  if(!cache.has(page)) {
    const pending=Promise.resolve().then(load);
    cache.set(page,pending);
    void pending.catch(()=>{if(cache.get(page)===pending)cache.delete(page);});
  }
  return cache.get(page);
}
