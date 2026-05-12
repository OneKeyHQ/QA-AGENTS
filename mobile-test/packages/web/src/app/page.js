import React from 'react';

import Index from '@/pages/Index';
import loadSteps from '@/utils/loadSteps';

function convertToNodesEdges(treeData) {
  const nodes = [];
  const edges = [];

  // 遍历树数据，创建 nodes 和 edges
  for (const key in treeData) {
    if (treeData.hasOwnProperty(key)) {
      const node = treeData[key];

      // 添加 node
      nodes.push({
        id: node.info.id,
        desc: node.info.describe,
        e2e: !!node.e2e,
        step: true,
        ...node.info,
      });

      // 如果节点 id 包含点号，则存在父节点
      if (node.info.id.includes('.')) {
        const parentId = node.info.id.substring(
          0,
          node.info.id.lastIndexOf('.'),
        );

        // 添加 edge
        edges.push({
          id: `edge_${parentId}_${node.info.id}`,
          sources: [parentId],
          targets: [node.info.id],
        });
      }
    }
  }

  return { nodes, edges };
}

export default async function Home() {
  const steps = await loadSteps();
  const { nodes: initialNodes, edges: initialEdges } =
    convertToNodesEdges(steps);

  return <Index initialEdges={initialEdges} initialNodes={initialNodes} />;
}
