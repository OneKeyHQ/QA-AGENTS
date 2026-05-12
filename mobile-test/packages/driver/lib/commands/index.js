import executeCmds from './execute';
import find from './find';
import gestures from './gestures';
import screenshots from './screenshots';

const commands = {};
Object.assign(commands, executeCmds, find, screenshots);

export { commands };
export default commands;
