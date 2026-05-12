const steps = {};
/**
 * define step
 * @param {*} info id,describe
 * @param {*} dataDependencies
 * @param {*} stepDependencies
 * @param {*} callback
 */
function step(info, dataDependencies, stepDependencies, callback) {
  const { id } = info;
  steps[id] = {
    info,
    dataDependencies,
    stepDependencies,
    callback,
  };
}
/**
 * get step by step id
 * @param {*} id step id
 * @returns
 */
export function getStep(id) {
  return steps[id];
}

export function getSteps() {
  return steps;
}

export default step;
