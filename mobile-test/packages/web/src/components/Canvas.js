import React, { useRef, useState, useCallback } from 'react';
import { Stage, Layer, Circle, Text, Arrow } from 'react-konva';
import Node from './Node';

const Canvas = ({
  width,
  height,
  nodes,
  setScale,
  setStagePosition,
  edges,
  stagePosition,
  onAddChild,
  updateNode,
  onSelect,
  selectedNodes,
}) => {
  const stageRef = useRef();
  const [localScale, setLocalScale] = useState(1);

  const handleWheel = useCallback(
    (e) => {
      e.evt.preventDefault();

      const scaleBy = 1.05;
      const stage = stageRef.current;
      const oldScale = stage.scaleX();

      const mousePointTo = {
        x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
        y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
      };

      const newScale =
        e.evt.deltaY > 0 ? oldScale * scaleBy : oldScale / scaleBy;
      setLocalScale(newScale);
      setScale(newScale);
      stage.scale({ x: newScale, y: newScale });

      const newPos = {
        x:
          -(mousePointTo.x - stage.getPointerPosition().x / newScale) *
          newScale,
        y:
          -(mousePointTo.y - stage.getPointerPosition().y / newScale) *
          newScale,
      };
      stage.position(newPos);
      setStagePosition(newPos);
    },
    [setScale, setStagePosition],
  );

  const isSelect = (cNode) => {
    return selectedNodes.some((node) => node.id === cNode.id);
  };
  return (
    <Stage
      width={width}
      height={height}
      onWheel={handleWheel}
      scaleX={localScale}
      scaleY={localScale}
      x={stagePosition.x}
      y={stagePosition.y}
      draggable
      ref={stageRef}
      onDragEnd={(e) => {
        setStagePosition(e.target.position());
      }}
    >
      <Layer>
        {nodes.map((node) => (
          <Node
            key={node.id}
            node={node}
            onAddChild={onAddChild}
            updateNode={updateNode}
            onSelect={onSelect}
            isSelect={isSelect(node)}
          />
        ))}
      </Layer>
      <Layer>
        {edges.map((edge) => (
          <Arrow
            key={edge.id}
            points={[
              edge.sections[0].startPoint.x,
              edge.sections[0].startPoint.y,
              edge.sections[0].endPoint.x,
              edge.sections[0].endPoint.y,
            ]}
            stroke="black"
            fill="black"
            strokeWidth={2}
          />
        ))}
      </Layer>
    </Stage>
  );
};

export default Canvas;
