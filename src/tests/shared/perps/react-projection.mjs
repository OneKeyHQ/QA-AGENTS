// Read-only diagnostic projections. Resolve React's committed branch before
// reading properties/hooks: a DOM node's __reactFiber can point at its alternate.
// No setter, event handler, atom or product service is invoked here.
export function committedFiber(fiber) {
  if (!fiber) throw Error("React fiber unavailable");
  const alternate = fiber.alternate;
  if (!alternate) {
    let root = fiber;
    while (root.return) root = root.return;
    if (root.tag !== 3 || root.stateNode?.current !== root)
      throw Error("Uncommitted React node");
    return fiber;
  }
  let a = fiber,
    b = alternate;
  for (;;) {
    const parentA = a.return;
    if (!parentA) break;
    const parentB = parentA.alternate;
    if (!parentB) {
      const next = parentA.return;
      if (next) {
        a = next;
        continue;
      }
      break;
    }
    if (parentA.child === parentB.child) {
      for (let c = parentA.child; c; c = c.sibling) {
        if (c === a) return fiber;
        if (c === b) return alternate;
      }
      throw Error("Detached React child");
    }
    if (a.return !== b.return) {
      a = parentA;
      b = parentB;
    } else {
      let found = false;
      for (let c = parentA.child; c; c = c.sibling) {
        if (c === a) {
          a = parentA;
          b = parentB;
          found = true;
          break;
        }
        if (c === b) {
          b = parentA;
          a = parentB;
          found = true;
          break;
        }
      }
      if (!found)
        for (let c = parentB.child; c; c = c.sibling) {
          if (c === a) {
            a = parentB;
            b = parentA;
            found = true;
            break;
          }
          if (c === b) {
            b = parentB;
            a = parentA;
            found = true;
            break;
          }
        }
      if (!found) throw Error("React child absent from both parent branches");
    }
    if (a.alternate !== b) throw Error("Inconsistent React branches");
  }
  if (a.tag !== 3) throw Error("Detached React root");
  return a.stateNode.current === a ? fiber : alternate;
}
export function fiberOwner(element, closestAncestor = false) {
  for (
    let node = element;
    node;
    node = closestAncestor ? node.parentElement : null
  ) {
    const key = Object.keys(node).find((k) => k.startsWith("__reactFiber$"));
    if (key && node[key]) return node[key];
  }
  throw Error("React fiber unavailable");
}
export function projectReactAll(
  locator,
  project,
  { closestAncestor = false } = {},
) {
  return locator.evaluateAll(
    (
      elements,
      { resolveSource, ownerSource, projectSource, closestAncestor },
    ) => {
      const resolve = Function(`return (${resolveSource})`)();
      const owner = Function(`return (${ownerSource})`)();
      const project = Function(`return (${projectSource})`)();
      return elements.map((e) =>
        project(resolve(owner(e, closestAncestor)), e),
      );
    },
    {
      resolveSource: committedFiber.toString(),
      ownerSource: fiberOwner.toString(),
      projectSource: project.toString(),
      closestAncestor,
    },
  );
}
