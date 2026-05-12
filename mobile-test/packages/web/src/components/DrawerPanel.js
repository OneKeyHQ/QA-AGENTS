import React, { useEffect, useState, useRef } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage } from 'react-konva';
import {
  Checkbox,
  Divider,
  VStack,
  StackDivider,
  Button,
  FormControl,
  FormLabel,
  Switch,
  Input,
  Box,
  Flex,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
} from '@chakra-ui/react';
import { TbRefresh } from 'react-icons/tb';
import { TfiHandDrag } from 'react-icons/tfi';

import Tesseract from 'tesseract.js';

import { BiErrorCircle } from 'react-icons/bi';
import useWebSocketCommand from '../hooks/useDebugWebSocket';
import useInterval from '../hooks/useInterval';

import StepActionList from './StepActionList';

const RATIO = 2;

const DrawerPanel = ({ isOpen, onClose, pid, addChildren, siblings }) => {
  const [screenshot, setScreenshot] = useState('');
  const [newRect, setNewRect] = useState(null);
  const [rectangles, setRectangles] = useState([]);
  const [selectedTextIds, setSelectedTextIds] = useState([]);
  const [executing, setExecuting] = useState(false);

  const [currentAction, setCurrentAction] = useState(null);

  const screenshotImage = useRef(null);
  const [isEditing, setIsEditing] = useState(false);

  const { open, close, commands, isActive } = useWebSocketCommand({
    url: 'ws://localhost:3333',
  });

  const siblingIndex = siblings.length;

  useEffect(() => {
    if (screenshot) {
      const image = new window.Image();
      image.src = screenshot.screenshot;
      image.width = screenshot.width / RATIO;
      image.height = screenshot.height / RATIO;

      image.onload = () => {
        screenshotImage.current.image(image);
        screenshotImage.current.getLayer().batchDraw();
      };
    }
  }, [screenshot.screenshot]);

  const handleMouseDown = e => {
    const { x, y } = e.target.getStage().getPointerPosition();
    setNewRect({
      x,
      y,
      width: 0,
      height: 0,
      id: `${x}-${y}`,
      _id: `${x}-${y}`,
      text: `point(${x},${y})`,
      isChecked: true,
      isUserDrawn: true,
    });
  };

  const handleMouseMove = e => {
    if (!newRect) {
      return;
    }
    const { x, y } = e.target.getStage().getPointerPosition();
    const width = x - newRect.x;
    const height = y - newRect.y;
    setNewRect({
      ...newRect,
      width,
      height,
      raw: {
        width: width * RATIO,
        height: height * RATIO,
        x: newRect.x * RATIO,
        y: newRect.y * RATIO,
        center: {
          x: (newRect.x + width / 2) * RATIO,
          y: (newRect.y + height / 2) * RATIO,
        },
      },
      code: [
        {
          action: 'click',
          parameters: {
            x: (newRect.x + width / 2) * RATIO,
            y: (newRect.y + height / 2) * RATIO,
          },
        },
      ],
    });
  };

  const handleMouseUp = () => {
    if (!newRect) {
      return;
    }
    const rectanglesCopy = rectangles.concat([newRect]);
    setRectangles(rectanglesCopy);
    setSelectedTextIds([...selectedTextIds, newRect.id]);
    setNewRect(null);
  };

  const updateScreenshot = async () => {
    if (!isActive) {
      return;
    }
    try {
      const response = await commands.getScreenshot();
      setScreenshot(response);
    } catch (error) {
      console.error('Error in getting screenshot:', error);
    }
  };

  const { start, stop, clear } = useInterval(updateScreenshot, 3000, false);
  useEffect(() => {
    if (isOpen) {
      open();
    } else {
      close();
    }
    return clear;
  }, [isOpen]);

  const playSteps = async () => {
    setExecuting(true);
    try {
      await commands.play(pid);
    } catch (error) {
      console.error('Error in getting screenshot:', error);
    } finally {
      setExecuting(false);
    }
  };

  const handleTextRecognition = async () => {
    if (screenshot) {
      const {
        data: { words },
      } = await Tesseract.recognize(screenshot.screenshot, 'eng+chi_sim', {});

      const wordRects = words.map((word, index) => ({
        x: word.bbox.x0 / RATIO,
        y: word.bbox.y0 / RATIO,
        width: (word.bbox.x1 - word.bbox.x0) / RATIO,
        height: (word.bbox.y1 - word.bbox.y0) / RATIO,
        id: `${pid}.${siblingIndex + index + 1}`,
        _id: `${pid}.${siblingIndex + index + 1}`,
        desc: word.text.toLowerCase().trim(),
        raw: {
          x: word.bbox.x0,
          y: word.bbox.y0,
          width: word.bbox.x1 - word.bbox.x0,
          height: word.bbox.y1 - word.bbox.y0,
          center: {
            x: word.bbox.x0 + (word.bbox.x1 - word.bbox.x0) / 2,
            y: word.bbox.y0 + (word.bbox.y1 - word.bbox.y0) / 2,
          },
        },
        code: [
          {
            action: 'click',
            parameters: {
              x: word.bbox.x0 + (word.bbox.x1 - word.bbox.x0) / 2,
              y: word.bbox.y0 + (word.bbox.y1 - word.bbox.y0) / 2,
            },
          },
        ],
        text: word.text.toLowerCase().trim(),
        isChecked: true,
      }));

      setRectangles(wordRects);
      setSelectedTextIds(wordRects.map(rect => rect.id));
      setCurrentAction(wordRects[0]);
    }
  };

  const handleCheckboxChange = id => {
    setSelectedTextIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = e => {
    if (e.target.checked) {
      setSelectedTextIds(rectangles.map(block => block.id));
    } else {
      setSelectedTextIds([]);
    }
  };
  const handleSaveSteps = async () => {
    const children = rectangles.filter(item =>
      selectedTextIds.includes(item.id),
    );
    await addChildren(
      pid,
      children.map((c, i) => {
        return { ...c, id: `${pid}.${siblingIndex + i + 1}` };
      }),
    );

    onClose();
  };

  const onAutoScreenshotChange = e => {
    if (e.currentTarget.checked) {
      start();
    } else {
      stop();
    }
  };

  const onStepClick = node => {
    setCurrentAction(node);
  };

  const onActionClick = async action => {
    switch (action.action) {
      case 'click':
        {
          await commands.click(action.parameters.x, action.parameters.y);
        }
        break;
      case 'input':
        {
          await commands.input(action.parameters);
        }
        break;
      case 'ocr':
        {
          const res = await commands.ocr({
            rectangle: {
              left: action.parameters.x,
              top: action.parameters.y,
              width: action.parameters.width,
              height: action.parameters.height,
            },
            stepId: currentAction.id,
          });
          alert(res.text);
        }
        break;
      default:
        break;
    }
  };
  const onActionDelete = (item, index) => {
    setRectangles(
      rectangles.map(rec => {
        let newRec = { ...rec };
        if (newRec._id === currentAction._id) {
          delete newRec.code[index];
          newRec.code = newRec.code.filter(x => x);
        }
        return newRec;
      }),
    );
  };
  const onOcrTextClick = async item => {
    const { text } = await commands.ocr({
      rectangle: {
        left: item.raw.x,
        top: item.raw.y,
        width: item.raw.width,
        height: item.raw.height,
      },
      noStore: true,
    });

    if (text.trim() == '') {
      return;
    }

    setRectangles(
      rectangles.map(rec => {
        let newRec = { ...rec };
        if (newRec._id === item._id) {
          newRec.text = text.trim();
          newRec.desc = newRec.text;
        }
        return newRec;
      }),
    );
  };

  const setNodeCode = code => {
    setRectangles(
      rectangles.map(rec => {
        let newRec = { ...rec };
        if (newRec._id === currentAction._id) {
          newRec.code = [...code];
        }
        return newRec;
      }),
    );
  };
  const handleBoxClick = () => {
    setIsEditing(true);
  };
  const handleInputBlur = () => {
    setIsEditing(false);
  };
  const handleInputChange = e => {
    setCurrentAction({ ...currentAction, text: e.target.value });
    setRectangles(
      rectangles.map(rec => {
        let newRec = { ...rec };
        if (newRec._id === currentAction._id) {
          newRec.text = e.target.value;
          newRec.desc = e.target.value;
        }
        return newRec;
      }),
    );
  };
  const currentRectangle = rectangles.find(
    x => x._id == currentAction?._id,
  ) || {
    code: [],
  };
  const visibleRectangles = rectangles.filter(rect =>
    selectedTextIds.includes(rect._id),
  );

  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size={'full'}>
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>
          <Flex alignItems={'center'} gap={10}>
            <Box> Step #{pid}</Box>
            <Divider orientation="vertical" />
            <Button colorScheme="blue" disabled={executing} onClick={playSteps}>
              execute
            </Button>
          </Flex>
        </DrawerHeader>
        <DrawerBody>
          <Flex gap={10} height={'80vh'}>
            <VStack
              divider={<StackDivider borderColor="gray.200" />}
              spacing={4}
              align="stretch"
              width={1024 / RATIO}
            >
              <Flex
                h="20px"
                alignItems={'center'}
                justifyContent={'space-between'}
              >
                <Box>Screenshot</Box>
                <Flex gap={3} alignItems={'center'}>
                  <TbRefresh
                    onClick={executing ? () => {} : updateScreenshot}
                    style={{ cursor: 'pointer' }}
                  />
                  <FormControl
                    display="flex"
                    alignItems="center"
                    width={'auto'}
                  >
                    <FormLabel htmlFor="auto-screenshot" mb="0" fontSize="xs">
                      Auto Screenshot?
                    </FormLabel>
                    <Switch
                      id="auto-screenshot"
                      onChange={onAutoScreenshotChange}
                    />
                  </FormControl>
                </Flex>
              </Flex>
              <Box>
                <Stage
                  width={screenshot.width / RATIO}
                  height={screenshot.height / RATIO}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                >
                  <Layer>
                    {screenshot && <KonvaImage ref={screenshotImage} />}

                    {visibleRectangles.map((rect, i) => (
                      <Rect
                        key={i}
                        x={rect.x}
                        y={rect.y}
                        width={rect.width}
                        height={rect.height}
                        fill="rgba(0,0,255,0.5)"
                      />
                    ))}
                    {newRect && (
                      <Rect
                        x={newRect.x}
                        y={newRect.y}
                        width={newRect.width}
                        height={newRect.height}
                        fill="rgba(0,0,255,0.2)"
                      />
                    )}
                  </Layer>
                </Stage>
              </Box>
            </VStack>

            <Divider orientation="vertical" />
            <VStack
              divider={<StackDivider borderColor="gray.200" />}
              spacing={4}
              align="stretch"
              width={230}
            >
              <Box h="20px" display={'flex'} justifyContent={'space-between'}>
                <Box>Text Blocks</Box>

                <Checkbox
                  isChecked={selectedTextIds.length === rectangles.length}
                  onChange={handleSelectAll}
                >
                  Select All
                </Checkbox>
              </Box>
              <Box overflow={'auto'}>
                <VStack align="stretch" mt="4" px={4}>
                  {rectangles.map(item => (
                    <Flex
                      cursor={'pointer'}
                      draggable="true"
                      onDragStart={e => {
                        e.dataTransfer.setData(
                          'text/plain',
                          JSON.stringify(item),
                        );
                      }}
                      gap={5}
                      alignItems={'center'}
                    >
                      <Checkbox
                        key={item._id}
                        isChecked={selectedTextIds.includes(item._id)}
                        onChange={() => handleCheckboxChange(item._id)}
                      >
                        {item.text}
                      </Checkbox>
                      {item.isUserDrawn && (
                        <Box>
                          <BiErrorCircle
                            onClick={() => {
                              onOcrTextClick(item);
                            }}
                          />
                        </Box>
                      )}
                      <Box>
                        <TfiHandDrag />
                      </Box>
                    </Flex>
                  ))}
                </VStack>
              </Box>
            </VStack>

            <Divider orientation="vertical" />
            <VStack
              divider={<StackDivider borderColor="gray.200" />}
              spacing={4}
              align="stretch"
              width={230}
            >
              <Box h="20px" display={'flex'} justifyContent={'space-between'}>
                <Box>Test Steps</Box>
              </Box>
              <Box overflow={'auto'}>
                <VStack align="stretch" mt="4" px={4}>
                  {rectangles
                    .filter(item => selectedTextIds.includes(item._id))
                    .map((item, index) => (
                      <Flex
                        p={2}
                        key={item._id}
                        border={
                          currentAction?._id === item._id
                            ? '1px solid'
                            : '1px solid transparent'
                        }
                        onClick={() => {
                          onStepClick({
                            ...item,
                            id: `${pid}.${siblingIndex + index + 1}`,
                          });
                        }}
                        cursor={'pointer'}
                      >
                        <Box>
                          #{`${pid}.${siblingIndex + index + 1}`}{' '}
                          {item.text.toLowerCase()}
                        </Box>
                      </Flex>
                    ))}
                </VStack>
              </Box>
            </VStack>
            <Divider orientation="vertical" />
            <VStack
              divider={<StackDivider borderColor="gray.200" />}
              spacing={4}
              align="stretch"
              flex={1}
            >
              <Box h="20px" display={'flex'} justifyContent={'space-between'}>
                <Flex gap={10} justify={'space-between'}>
                  {currentAction &&
                    (isEditing ? (
                      <Input
                        defaultValue={currentAction.text}
                        onChange={handleInputChange}
                        onBlur={handleInputBlur}
                        autoFocus
                      />
                    ) : (
                      <Box onClick={handleBoxClick}>
                        #{currentAction.id} {currentAction.text.toLowerCase()}
                      </Box>
                    ))}
                  <Box>Actions</Box>
                </Flex>
              </Box>
              <Box overflow={'auto'}>
                <StepActionList
                  itemData={currentRectangle.code}
                  setItemData={setNodeCode}
                  onActionClick={onActionClick}
                  onDelete={onActionDelete}
                />
              </Box>
            </VStack>
          </Flex>
        </DrawerBody>
        <DrawerFooter justifyContent={'center'}>
          <Flex gap={20} justifyContent={'center'}>
            <Button
              colorScheme="blue"
              disabled={executing}
              onClick={handleTextRecognition}
            >
              Fetch TextBlocks
            </Button>
            <Button
              colorScheme="blue"
              disabled={executing}
              onClick={handleSaveSteps}
            >
              Save Steps
            </Button>
          </Flex>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default DrawerPanel;
