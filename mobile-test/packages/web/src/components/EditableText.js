import React, { useState, useRef } from 'react';
import { Stage, Layer, Text } from 'react-konva';
import debounce from 'lodash.debounce';

const EditableText = ({ initialText, x, y, onChange }) => {
  const [text, setText] = useState(initialText);
  const textRef = useRef();

  const handleDoubleClick = () => {
    const textPosition = textRef.current.getAbsolutePosition();
    const stageBox = textRef.current
      .getStage()
      .container()
      .getBoundingClientRect();
    const areaPosition = {
      x: stageBox.left + textPosition.x,
      y: stageBox.top + textPosition.y,
    };

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    textarea.value = text;
    textarea.style.position = 'absolute';
    textarea.style.top = `${areaPosition.y}px`;
    textarea.style.left = `${areaPosition.x}px`;
    textarea.style.width = `${textRef.current.width() + 50}px`;

    textarea.focus();

    const cleanUp = debounce((newText) => {
      setText(newText);
      if (onChange) {
        onChange(newText);
      }
      // 检查 textarea 是否仍然是 body 的子节点
      if (document.body.contains(textarea)) {
        document.body.removeChild(textarea);
      }
    }, 300);

    // textarea.addEventListener('keydown', function (e) {
    //   if (e.key === 'Enter') {
    //     cleanUp(textarea.value);
    //   }
    // });

    textarea.addEventListener('blur', function (e) {
      cleanUp(textarea.value);
    });
  };

  return (
    <Text
      ref={textRef}
      text={text}
      x={x}
      y={y}
      fontSize={20}
      onDblClick={handleDoubleClick}
    />
  );
};

export default EditableText;
