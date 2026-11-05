import test from 'node:test';
import assert from 'node:assert/strict';
import {imageResourceIdentity} from '../image-resource.mjs';
test('QR raw image and resized NetworkAvatar retain the same resource identity',()=>{
 const original='https://uni.onekey-asset.com/static/chain/arbitrum.png';
 const resized=original+'?x-tos-process=image%2Fresize%2Cw_96';
 assert.notEqual(original,resized);
 assert.equal(imageResourceIdentity(original),imageResourceIdentity(resized));
});
test('chain, origin, version and unrelated queries remain distinct',()=>{
 const a='https://uni.onekey-asset.com/static/chain/arbitrum.png';
 for(const b of [a.replace('arbitrum','ethereum'),a.replace('uni.onekey','other.onekey'),a+'?version=2',a+'?network=eth'])assert.notEqual(imageResourceIdentity(a),imageResourceIdentity(b));
 assert.throws(()=>imageResourceIdentity('not a URL'));
});
