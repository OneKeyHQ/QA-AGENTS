import React, { memo } from 'react';
import { Box, IconButton, HStack } from '@chakra-ui/react';

function ActionBar({ nodes, bars }) {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  return (
    <Box
      position="absolute" // 固定位置
      left="50%" // 水平居中
      bottom="5%" // 从顶部开始
      transform="translateX(-50%)" // 使其真正居中
      bg="#fff" // 工具栏背景颜色
      padding={'5px'} // 内边距
      border={'1px solid #dee0e3'}
      borderRadius={8}
    >
      <HStack>
        {' '}
        {Object.values(bars).map((Icon, index) => (
          <IconButton
            key={index}
            aria-label={`${Icon.component.name} icon`}
            icon={<Icon.component />}
            onClick={() => Icon.handle()}
            variant="outline"
            size="md"
            border={'none'}
            cursor={'pointer'}
          />
        ))}
      </HStack>
    </Box>
  );
}

export default ActionBar;
