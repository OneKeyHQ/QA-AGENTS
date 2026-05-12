'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { FaPlay, FaSave, FaMagic } from 'react-icons/fa';
import { GrAdd } from 'react-icons/gr';
import { GrDocumentTest } from 'react-icons/gr';
import { IoLogoFigma } from 'react-icons/io5';

import { Spinner, Flex, useDisclosure } from '@chakra-ui/react';

import { updateLayout, calculateLayout } from '../utils/elkLayout';

import Toolbar from '@/components/Toolbar';
import ActionBar from '@/components/Actionbar';

const Canvas = dynamic(() => import('@/components/Canvas'), {
  ssr: false,
});
const DrawerPanel = dynamic(() => import('@/components/DrawerPanel'), {
  ssr: false,
});
const Preview = dynamic(() => import('@/components/Preview'), {
  ssr: false,
});

const findSiblings = (nodes, edges, parentId) => {
  if (parentId) {
    const siblingTargets = edges
      .filter(edge => edge.sources.includes(parentId))
      .flatMap(edge => edge.targets);
    // 返回作为兄弟节点的目标节点信息
    return nodes.filter(node => siblingTargets.includes(node.id));
  }
  // 找到所有目标节点（存在于 edges.targets 中的节点）
  const allTargets = new Set(edges.flatMap(edge => edge.targets));

  return nodes.filter(node => !allTargets.has(node.id));
};

export default function Index({ initialNodes, initialEdges }) {
  const [size, setSize] = useState({
    width: 0,
    height: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const [nodes, setNodes] = useState([]);

  const [selectedNodes, setSelectedNodes] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [edges, setEdges] = useState([]);

  const [scale, setScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({
    x: 0,
    y: 0,
  });

  const processNodes = async () => {
    setIsLoading(true); // 开始加载时设置 isLoading 为 true
    try {
      let storeNode = nodes.filter(n => n.isNew);
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nodes: storeNode }),
      });

      const data = await response.json();

      setNodes(olds => olds.map(old => ({ ...old, isNew: undefined })));
    } catch (error) {
      console.error('Error processing nodes:', error);
    }
    setIsLoading(false);
  };

  const markE2ECase = () => {
    const isParent = (parent, child) => child.id.startsWith(parent.id + '.');
    const leafNodes = nodes
      .filter(node => !node.e2e)
      .filter(node => !nodes.some(otherNode => isParent(node, otherNode)));
    const leafIds = leafNodes.map(l => l.id);
    const leafNodeKV = leafNodes.reduce((pre, curr) => {
      return {
        ...pre,
        [curr.id]: curr,
      };
    }, {});

    setNodes(oldNodes => {
      return oldNodes.map(node => {
        if (leafIds.includes(node.id)) {
          return { ...leafNodeKV[node.id], isNew: true, e2e: true };
        }
        return node;
      });
    });
  };

  const onAddChild = async (parentId = '') => {
    // 找到父节点下所有子节点
    const siblings = findSiblings(nodes, edges, parentId);
    // 新节点的 ID 是父节点 ID 后跟一个点和兄弟节点的数量加一
    const newNodeId =
      '' +
      (siblings.length <= 0 && !parentId
        ? 1
        : parentId
        ? `${parentId}.${siblings.length + 1}`
        : siblings.length + 1);

    const pointedNode = nodes.find(node => node.id === parentId);

    // 创建新节点
    const nextNode = {
      id: newNodeId,
      desc: `click to edit`,
      isNew: true,
      step: true,
      code: [],
    };

    // 创建连接父节点和新节点的边
    const nextEdge = {
      id: `${parentId}-${newNodeId}`, // 创建基于父子关系的唯一边 ID
      sources: [parentId],
      targets: [newNodeId],
    };

    const { newNodes, newEdges } = await updateLayout(
      pointedNode,
      [...nodes, nextNode],
      parentId ? [...edges, nextEdge] : edges,
      size,
    );
    setNodes(newNodes);
    setEdges(newEdges);
  };

  const addChildren = async (parentId, children) => {
    const pointedNode = nodes.find(node => node.id === parentId);
    const childrenNodes = [];
    const childrenEdges = [];

    Array.from(children).forEach(n => {
      const nextNode = {
        id: n.id,
        desc: n.desc,
        isNew: true,
        step: true,
        ...n,
      };

      const nextEdge = {
        id: `${parentId}-${n.id}`,
        sources: [parentId],
        targets: [n.id],
      };

      childrenNodes.push(nextNode);
      childrenEdges.push(nextEdge);
    });

    const { newNodes, newEdges } = await updateLayout(
      pointedNode,
      [...nodes, ...childrenNodes],
      [...edges, ...childrenEdges],
      size,
    );
    setNodes(newNodes);
    setEdges(newEdges);
  };

  useEffect(() => {
    const performLayout = async () => {
      const { newNodes, newEdges } = await calculateLayout(
        initialNodes,
        initialEdges,
        {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      );
      setEdges(newEdges);
      setNodes(newNodes);
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    performLayout();
    // 当组件挂载到客户端后，更新尺寸
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const onViewportChange = newPosition => {
    // 更新主画布的位置
    setStagePosition(newPosition);
  };

  const updateNode = newNode => {
    setNodes(oldNodes => {
      return oldNodes.map(oldNode => {
        if (oldNode.id == newNode.id) {
          return { ...newNode };
        }
        return { ...oldNode };
      });
    });
  };
  const toolBars = {
    FaMagic: {
      component: FaMagic,
      handle: () => {},
    },
    IoLogoFigma: { component: IoLogoFigma, handle: () => {} },
    GrAdd: {
      component: GrAdd,
      handle: () => {
        onAddChild('');
      },
    },
    GrDocumentTest: {
      component: GrDocumentTest,
      handle: markE2ECase,
    },
    FaSave: {
      component: FaSave,
      handle: processNodes,
    },
  };
  const actionBars = {
    FaPlay: { component: FaPlay, handle: onOpen },
  };

  const onNodeSelect = sNode => {
    const exists = selectedNodes.some(node => node.id === sNode.id);
    setSelectedNodes(oldNodes => {
      return exists ? [] : [sNode];
    });
  };
  const selectedSiblings =
    findSiblings(nodes, edges, selectedNodes[0]?.id) || [];
  return (
    <>
      <Canvas
        width={size.width}
        height={size.height}
        nodes={nodes}
        edges={edges}
        setScale={setScale}
        stagePosition={stagePosition}
        setStagePosition={setStagePosition}
        onAddChild={onAddChild}
        updateNode={updateNode}
        onSelect={onNodeSelect}
        selectedNodes={selectedNodes}
      />
      {/* <Preview
        nodes={nodes}
        width={size.width}
        height={size.height}
        stageScale={scale}
        edges={edges}
        stagePosition={stagePosition}
        setStagePosition={setStagePosition}
        onViewportChange={onViewportChange}
      /> */}
      {isLoading && (
        <Flex
          position="fixed"
          top="0"
          left="0"
          right="0"
          bottom="0"
          justifyContent="center"
          alignItems="center"
          backgroundColor="rgba(255, 255, 255, 0.7)"
          zIndex="1000"
        >
          <Spinner size="xl" color="blue.500" />
        </Flex>
      )}
      <Toolbar bars={toolBars} />
      {isOpen && (
        <DrawerPanel
          isOpen={isOpen}
          onClose={onClose}
          pid={selectedNodes[0]?.id}
          siblings={selectedSiblings}
          addChildren={addChildren}
        />
      )}

      <ActionBar bars={actionBars} nodes={selectedNodes} />
    </>
  );
}
