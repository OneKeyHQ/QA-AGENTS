// Characterization of the shared amount input. Does not redefine the manual
// acceptance rule that a negative amount must not be submitted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSource} from './source.mjs';
const {sanitizeAmountInputText}=evaluateSource('packages/kit/src/views/Send/components/SendAutoSizeAmountInput/amountInputTextUtils.ts');
for(const [raw,expected]of [['-1','1'],['+1','1'],['abc',''],['NaN',''],['Infinity',''],['1e3','13'],['1,000','1.000'],['😀',''],['1 2','12'],['1.2.3','1.23'],['。1','0.1'],['00012','12'],['000.1','0.1'],['0.00','0.00']])test(`D20-37/65 source sanitation ${JSON.stringify(raw)} → ${expected}`,()=>assert.equal(sanitizeAmountInputText(raw),expected));
