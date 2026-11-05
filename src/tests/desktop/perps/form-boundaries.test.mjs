// Desktop manual-row input and validation coverage. No order or fund submission.
import {formSuite} from '../../shared/perps/desktop-form-boundaries.mjs';
import {runNonOrderCLI} from '../../shared/perps/non-order-ui.mjs';
export const platform='desktop';
export const displayName='表单边界与逐项校验';
export const {testCases,setup}=formSuite;
export const run=()=>runNonOrderCLI({testCases,setup,platform});
if(process.argv[1]&&import.meta.url===`file://${process.argv[1]}`)run().then(r=>process.exit(r.failed?1:0)).catch(e=>{console.error(e);process.exit(1)});
