// layout.js 或任何其他合适的文件名
import ELK from 'elkjs/lib/elk.bundled.js';
const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.layered.crossingMinimization.semiInteractive': true,
  'elk.direction': 'RIGHT', // 树形布局的方向: 'UP', 'DOWN', 'LEFT', 'RIGHT'
  'elk.layered.spacing.nodeNodeBetweenLayers': '200', // 层与层之间的间距
  'elk.nodeSpacing': '200', // 节点间的间距
  'elk.edgeRouting': 'POLYLINE', // 边的路径样式: 'ORTHOGONAL', 'POLYLINE', 'SPLINES'
  'elk.layered.nodePlacement.strategy': 'SIMPLE',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
};
const elk = new ELK({
  workerUrl: '../node_modules/elkjs/lib/elk-worker.min.js',
  defaultLayoutOptions: elkOptions,
});

export const calculateLayout = async (nodes, edges, size) => {
  const graph = {
    id: 'root',
    children: nodes.map((node) => ({
      ...node,
      width: 200,
      height: 250,
    })),
    edges: edges.map((edge) => {
      const { container, sections, x, y, ...rest } = edge;
      return rest;
    }),
  };

  const { children, edges: nEdges } = await elk.layout(graph);
  // 计算边界框
  let minX = Infinity,
    maxX = 0,
    minY = Infinity,
    maxY = 0;
  children.forEach((child) => {
    minX = Math.min(minX, child.x);
    maxX = Math.max(maxX, child.x + child.width);
    minY = Math.min(minY, child.y);
    maxY = Math.max(maxY, child.y + child.height);
  });

  const graphWidth = maxX - minX;
  const graphHeight = maxY - minY;
  const graphCenterX = minX + graphWidth / 2;
  const graphCenterY = minY + graphHeight / 2;

  const stageCenterX = size.width / 2;
  const stageCenterY = size.height / 2;

  const offsetX = stageCenterX - graphCenterX;
  const offsetY = stageCenterY - graphCenterY;

  const centeredNodes = children.map((child) => ({
    ...child,
    x: child.x + offsetX,
    y: child.y + offsetY,
  }));

  // 转换边的坐标
  const centeredEdges = nEdges.map((edge) => ({
    ...edge,
    sections: edge.sections.map((section) => ({
      startPoint: {
        x: section.startPoint.x + offsetX,
        y: section.startPoint.y + offsetY,
      },
      endPoint: {
        x: section.endPoint.x + offsetX,
        y: section.endPoint.y + offsetY,
      },
      bendPoints:
        section.bendPoints &&
        section.bendPoints.map((bp) => ({
          x: bp.x + offsetX,
          y: bp.y + offsetY,
        })),
    })),
  }));

  return { newNodes: centeredNodes, newEdges: centeredEdges };
};

export const updateLayout = async (pointedNode, nodes, edges, size) => {
  return await calculateLayout(
    [
      ...nodes.map((node) => {
        const { x, y, ...rest } = node;
        return rest;
      }),
    ],
    edges.map((edge) => {
      const { container, sections, x, y, ...rest } = edge;
      return rest;
    }),
    size,
  );
};
