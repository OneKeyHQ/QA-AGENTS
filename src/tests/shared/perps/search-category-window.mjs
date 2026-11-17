import assert from 'node:assert/strict';
import {expectedSearchCategories} from './search-evidence.mjs';

export class SearchCategoryWindowChanged extends Error {}

// Raw backend-config atom only. Never use the rendered/filtered list as oracle.
export function projectAppliedSearchCategories(start) {
  for(let f=start;f;f=f.return) {
    const name=f.type?.name||f.type?.displayName||f.type?.type?.name;
    if(name!=='BasePerpTokenSelectorContent')continue;
    for(let h=f.memoizedState,i=0;h&&i<3000;h=h.next,i++) {
      if(h.memoizedState?.[2]?.name==='perpTokenSelectorTabsAtom') {
        const raw=h.memoizedState[0];
        if(!Array.isArray(raw))throw Error('Readable raw category atom required');
        return raw.map(t=>({tabId:t.tabId,name:t.name,tokens:t.tokens}));
      }
    }
  }
  throw Error('Named raw category atom unavailable in committed owner');
}

export function assertSearchCategoryWindow({serverBefore,serverAfter,appliedBefore,appliedAfter,actual,coins,name}) {
  const snapshots=[serverBefore,serverAfter,appliedBefore,appliedAfter].map(raw=>{
    const tab=expectedSearchCategories(raw).find(t=>t.name===name);
    return tab?{...tab,tokens:[...tab.tokens].sort()}:null;
  });
  if(!snapshots[0]||snapshots.some(s=>JSON.stringify(s)!==JSON.stringify(snapshots[0])))
    throw new SearchCategoryWindowChanged(`${name} server/applied config changed or has not converged; cannot compare different snapshots`);
  assert.deepEqual([...actual].sort(),snapshots[0].tokens.filter(c=>coins.has(c)).sort(),`Configured category ${name}`);
  return snapshots[0];
}
