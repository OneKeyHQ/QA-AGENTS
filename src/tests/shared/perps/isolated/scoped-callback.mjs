// Select one callback inside a named source function. Duplicate names elsewhere
// (e.g. live vs empty-size buttons) cannot silently select the wrong branch.
import { readSource, ts, evaluateText } from "./source.mjs";
export function scopedCallback(file, owner, name, globals) {
  const source = readSource(file),
    ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  const parents = ast.statements.filter(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === owner,
  );
  if (parents.length !== 1) throw Error(`Expected one source owner ${owner}`);
  const found = [];
  function walk(n) {
    if (
      ts.isVariableDeclaration(n) &&
      n.name?.text === name &&
      ts.isCallExpression(n.initializer)
    )
      found.push(n.initializer.arguments[0]);
    ts.forEachChild(n, walk);
  }
  walk(parents[0]);
  if (found.length !== 1 || !ts.isArrowFunction(found[0]))
    throw Error(`Expected one callback ${owner}.${name}`);
  return evaluateText(
    file,
    `export const fragment = ${found[0].getText(ast)}`,
    { globals },
  ).fragment;
}
