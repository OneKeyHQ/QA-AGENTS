import React, { useEffect } from 'react';
import { Stage, Layer, Circle, Rect, Text, Arrow } from 'react-konva';
import Node from './Node';

const Preview = ({
  width,
  height,
  nodes,
  edges,
  stagePosition,
  setStagePosition,
  stageScale,
  onViewportChange,
}) => {
  const previewScale = 1 / 5; // 假设预览视图是主视图的1/4大小
  const viewportWidth = width / 3;
  const viewportHeight = height / 3;

  // Function to handle drag movements of the viewport rectangle in the preview
  const handleViewportDrag = (event) => {
    const newPosition = {
      x: viewportWidth / 2 - event.target.x(),
      y: viewportHeight / 2 - event.target.y(),
    };

    console.log(newPosition);
    onViewportChange(newPosition);
  };

  // 调整视窗尺寸
  const viewportRect = {
    width: viewportWidth, // 视窗尺寸根据需要调整
    height: viewportHeight, // 视窗尺寸根据需要调整

    x: (width - viewportWidth) / 2,
    y: (height - viewportHeight) / 2,

    stroke: 'green',
    strokeWidth: 4,
    draggable: true,
    onDragMove: handleViewportDrag,
  };

  return (
    <Stage
      width={width * previewScale}
      height={height * previewScale}
      scaleX={previewScale / 2}
      scaleY={previewScale / 2}
      x={0}
      y={0}
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        border: '1px solid grey',
        backgroundColor: 'lightgrey',
      }}
    >
      <Layer>
        {nodes.map((node) => (
          <Node key={node.id} node={node} />
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

export default Preview;
