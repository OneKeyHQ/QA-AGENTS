import React from 'react';
import { Button, Select, Input, HStack, VStack, Box } from '@chakra-ui/react';

import { FaPlay } from 'react-icons/fa6';
import { TbHttpDelete } from 'react-icons/tb';
import { TfiHandDrag } from 'react-icons/tfi';

const actionConfig = {
  click: [
    { name: 'x', placeholder: 'x (int)', type: 'number' },
    { name: 'y', placeholder: 'y (int)', type: 'number' },
  ],
  ocr: [
    { name: 'x', placeholder: 'x (int)', type: 'number' },
    { name: 'y', placeholder: 'y (int)', type: 'number' },
    { name: 'width', placeholder: 'width (int)', type: 'number' },
    { name: 'height', placeholder: 'height (int)', type: 'number' },
  ],
  play: [{ name: 'play', placeholder: 'play id (string)', type: 'text' }],
  pause: [{ name: 'delay', placeholder: 'delay ms (int)', type: 'number' }],
  input: [
    {
      name: 'dataSource',
      placeholder: 'Select data source',
      type: 'select',
      options: ['User Input', 'Step', 'Data'],
    },
    { name: 'userInput', placeholder: 'Enter value', type: 'text' },
    { name: 'stepId', placeholder: 'Step ID', type: 'text' },
    { name: 'keyForLodash', placeholder: 'Key for lodash', type: 'text' },
  ],
};

const ListItem = ({
  onUpdate,
  index,
  itemData,
  onActionClick,
  onDelete,
  onDragStart,
  onListDrop,
}) => {
  const { action, parameters } = itemData;

  const handleActionChange = e => {
    const newAction = e.target.value;
    onUpdate({ ...itemData, action: newAction });
  };

  const handleInputChange = (name, value) => {
    onUpdate({ ...itemData, parameters: { ...parameters, [name]: value } });
  };
  const renderInputFields = () => {
    const config = actionConfig[action];
    if (!config) return null;

    return config.map(fieldConfig => {
      if (fieldConfig.type === 'select') {
        // 渲染下拉选择器
        return (
          <Select
            key={fieldConfig.name}
            placeholder={fieldConfig.placeholder}
            value={parameters[fieldConfig.name] || ''}
            onChange={e => handleInputChange(fieldConfig.name, e.target.value)}
          >
            {fieldConfig.options.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        );
      } else {
        // 对于 input 动作的特定字段，基于 dataSource 的值来决定是否渲染
        if (action === 'input') {
          if (
            parameters['dataSource'] === 'User Input' &&
            fieldConfig.name === 'userInput'
          ) {
            return (
              <Input
                key="userInput"
                placeholder="Enter value"
                value={parameters['userInput'] || ''}
                onChange={e => handleInputChange('userInput', e.target.value)}
              />
            );
          } else if (
            parameters['dataSource'] === 'Step' &&
            fieldConfig.name === 'stepId'
          ) {
            return (
              <Input
                key="stepId"
                placeholder="Step ID"
                value={parameters['stepId'] || ''}
                onChange={e => handleInputChange('stepId', e.target.value)}
              />
            );
          } else if (
            (parameters['dataSource'] === 'Step' ||
              parameters['dataSource'] === 'Data') &&
            fieldConfig.name === 'keyForLodash'
          ) {
            return (
              <Input
                key="keyForLodash"
                placeholder="Key for lodash"
                value={parameters['keyForLodash'] || ''}
                onChange={e =>
                  handleInputChange('keyForLodash', e.target.value)
                }
              />
            );
          }
          return null;
        }

        // 对于其他动作类型，正常渲染输入字段
        return (
          <Input
            key={fieldConfig.name}
            placeholder={fieldConfig.placeholder}
            type={fieldConfig.type}
            value={parameters[fieldConfig.name] || ''}
            onChange={e => handleInputChange(fieldConfig.name, e.target.value)}
          />
        );
      }
    });
  };
  const handleDrop = e => {
    e.preventDefault();
    const droppedData = JSON.parse(e.dataTransfer.getData('text/plain'));

    let parameters = {};
    switch (action) {
      case 'click':
        {
          parameters = {
            x: droppedData.raw.center.x,
            y: droppedData.raw.center.y,
          };
        }
        break;
      case 'ocr':
        {
          parameters = {
            x: droppedData.raw.x,
            y: droppedData.raw.y,
            width: droppedData.raw.width,
            height: droppedData.raw.height,
          };
        }
        break;
      default:
        break;
    }

    onUpdate({
      action,
      parameters,
    });
  };

  const handleDragStart = e => {
    e.dataTransfer.setData('itemindex', index);
  };

  return (
    <HStack
      spacing={4}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        if (e.dataTransfer.types.includes('itemindex')) {
          // 当拖动用于排序
          onListDrop(e, index);
        } else {
          // 当为原有的 onDrop 功能
          handleDrop(e);
        }
      }}
      draggable="true"
      onDragStart={handleDragStart}
    >
      <Box cursor={'pointer'}>
        <TbHttpDelete
          onClick={() => {
            onDelete(itemData, index);
          }}
        />
      </Box>
      <Select
        placeholder="Select action"
        value={action}
        onChange={handleActionChange}
      >
        {Object.keys(actionConfig).map(action => (
          <option key={action} value={action}>
            {action}
          </option>
        ))}
      </Select>
      {renderInputFields()}

      <Box>
        <FaPlay
          cursor={'pointer'}
          onClick={() => {
            onActionClick(itemData);
          }}
        />
      </Box>
      <Box cursor={'grab'}>
        <TfiHandDrag />
      </Box>
    </HStack>
  );
};

const StepActionList = ({ itemData, setItemData, onActionClick, onDelete }) => {
  const updateItemData = (index, data) => {
    const newData = [...itemData];
    newData[index] = data;
    setItemData(newData);
  };

  const addItem = () =>
    setItemData([...itemData, { action: '', parameters: {} }]);

  const handleListDrop = (e, toIndex) => {
    const fromIndex = parseInt(e.dataTransfer.getData('itemindex'));
    let updatedItems = [...itemData];
    const movedItem = updatedItems.splice(fromIndex, 1)[0];
    updatedItems.splice(toIndex, 0, movedItem);
    setItemData(updatedItems);
  };
  return (
    <VStack spacing={4}>
      {itemData.map((item, index) => (
        <ListItem
          key={index}
          index={index}
          itemData={item}
          onUpdate={data => updateItemData(index, data)}
          onActionClick={onActionClick}
          onDelete={onDelete}
          onListDrop={handleListDrop}
        />
      ))}
      <Button onClick={addItem}>add</Button>
    </VStack>
  );
};

export default StepActionList;
