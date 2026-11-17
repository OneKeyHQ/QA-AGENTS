// Independent file oracle. No production formatter or export builder is used.
import assert from 'node:assert/strict';
export function parseFundingCsv(text) {
  text=String(text).replace(/^\uFEFF/u,'');
  const rows=[];let row=[],field='',quoted=false,closed=false;
  const cell=()=>{row.push(field);field='';closed=false;};
  const line=()=>{cell();rows.push(row);row=[];};
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) {
      if(c==='"') {if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
      else field+=c;
      continue;
    }
    if(c===','){cell();continue;}
    if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;line();continue;}
    if(closed)throw Error('Unexpected CSV content after quote');
    if(c==='"'){if(field)throw Error('Unexpected CSV quote');quoted=true;}else field+=c;
  }
  if(quoted)throw Error('Unclosed CSV quote');
  if(field||row.length||closed)line();
  return rows;
}
function decimal(raw) {
  const m=/^(-?)(\d+)(?:\.(\d+))?$/u.exec(String(raw));
  assert.ok(m,`Finite decimal required: ${raw}`);
  return {n:BigInt(m[2]+(m[3]??''))*(m[1]?-1n:1n),scale:10n**BigInt((m[3]??'').length)};
}
function canonical(raw,absolute=false) {
  decimal(raw);
  let s=String(raw).replace(/^-/,''),[a,b='']=s.split('.');
  a=a.replace(/^0+(?=\d)/u,'');b=b.replace(/0+$/u,'');s=a+(b?`.${b}`:'');
  return !absolute&&String(raw).startsWith('-')&&s!=='0'?`-${s}`:s;
}
export function fundingRateText(raw) {
  const {n,scale}=decimal(raw),abs=n<0n?-n:n;
  const precision=abs*10000n<scale?6:4,unit=10n**BigInt(precision);
  const scaled=abs*100n*unit,rounded=scaled/scale+(scaled%scale*2n>=scale?1n:0n);
  const digits=String(rounded).padStart(precision+1,'0');
  return `${n<0n?'-':''}${digits.slice(0,-precision)}.${digits.slice(-precision)}%`;
}
export function assertFundingCsv(bytes,records,paymentTokens) {
  const rows=parseFundingCsv(bytes.toString('utf8'));
  assert.deepEqual(rows[0],['时间','市场','数量','方向','资金费','结算币种','费率']);
  const sorted=[...records].sort((a,b)=>b.time-a.time||b.hash.localeCompare(a.hash));
  assert.equal(rows.length,sorted.length+1,'CSV exports all filtered records, not only the current page');
  for(const [i,r] of sorted.entries()) {
    const d=r.delta,size=decimal(d.szi).n;
    const [dex,...rest]=d.coin.split(':');
    const market=rest.length?`${rest.join(':')} (${dex})`:dex;
    assert.ok(paymentTokens[d.coin],`Independent settlement token required: ${d.coin}`);
    const safe=s=>/^[=+\-@\t\r]/u.test(s)?`'${s}`:s;
    assert.deepEqual(rows[i+1],[new Date(r.time).toISOString(),safe(market),canonical(d.szi,true),size>0n?'做多':size<0n?'做空':"'--",canonical(d.usdc),safe(paymentTokens[d.coin]),fundingRateText(d.fundingRate)],`CSV record ${i+1} matches independent raw identity and values`);
  }
  return sorted.length;
}
