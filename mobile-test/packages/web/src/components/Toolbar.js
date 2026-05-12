import React, { memo } from 'react';
import { Box, IconButton, VStack } from '@chakra-ui/react';

function Toolbar({ bars }) {
  return (
    <Box
      position="absolute" // 固定位置
      left="20px" // 工具栏在左边
      top="15%" // 从顶部开始
      w="52px" // 工具栏宽度
      bg="#fff" // 工具栏背景颜色
      padding={5} // 内边距
      border={'1px solid #dee0e3'}
      borderRadius={8}
    >
      <VStack>
        {Object.values(bars).map((Icon, index) => (
          <IconButton
            key={index}
            aria-label={`${Icon.component.name} icon`}
            icon={<Icon.component />}
            onClick={() => Icon.handle()}
            variant="outline"
            size="md" // 大小
            border={'none'}
            cursor={'pointer'}
            // colorScheme="teal" // 颜色方案
          />
        ))}
      </VStack>
    </Box>
  );
}

export default Toolbar;
