import React, { useCallback, memo } from 'react';

import { Group, Rect, Text, Path, Layer } from 'react-konva';
import EditableText from './EditableText';

const Node = ({ node, onAddChild, updateNode, onSelect, isSelect }) => {
  const handlePlusClick = useCallback(
    (e) => {
      e.cancelBubble = true;
      onAddChild && onAddChild(node.id);
    },
    [onAddChild, node.id],
  );

  const handleTextChange = (newText) => {
    updateNode({ ...node, desc: newText, isNew: true });
  };

  const handleGroupClick = useCallback(() => {
    onSelect && onSelect(node);
  }, [onSelect, node]);

  const handleMouseEnter = useCallback((e) => {
    const container = e.target.getStage().container();
    container.style.cursor = 'pointer';
  }, []);

  const handleMouseLeave = useCallback((e) => {
    const container = e.target.getStage().container();
    container.style.cursor = 'default';
  }, []);

  const handleCopyClick = async (e) => {
    e.cancelBubble = true;

    try {
      await navigator.clipboard.writeText(node.id);
      alert('Text copied to clipboard');
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <Group
      x={node.x}
      y={node.y}
      onClick={handleGroupClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Rect
        width={200}
        height={250}
        strokeWidth={isSelect ? 8 : 4}
        stroke={node.isNew ? 'red' : 'black'}
        fill="rgb(240, 244, 252)"
      />

      <Group x={0} y={0} onClick={handlePlusClick}>
        <Rect
          width={200}
          height={50}
          fill="rgb(254, 241, 206)"
          stroke={node.isNew ? 'red' : 'black'}
          strokeWidth={isSelect ? 8 : 4}
        />
        <Text x={10} y={10} text={`# ${node.id}`} fontSize={28} fill="black" />
      </Group>

      <Group x={0} y={0}>
        {/* <Text
          x={10}
          y={70}
          text={`desc: ${node.desc}`}
          fontSize={18}
          fill="black"
          align="left"
        /> */}
        <EditableText
          initialText={node.desc}
          x={10}
          y={70}
          onChange={handleTextChange}
        />
      </Group>
      {node.e2e && (
        <Group x={130} y={220} rotation={-45} onClick={handleCopyClick}>
          <Text x={10} y={10} text={`e2e`} fontSize={28} fill="green" />
        </Group>
      )}

      {/* {isHovered && (
        <Group x={200} y={25}>
          <Rect width={50} height={50} fill="blue" />
          <Path
            x={10}
            y={10}
            data="M 5 15 L 25 15 M 15 5 L 15 25"
            stroke="white"
            strokeWidth={2}
          />
        </Group>
      )} */}
    </Group>
  );
};

export default Node;
