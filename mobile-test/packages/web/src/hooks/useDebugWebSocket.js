import { useState, useCallback, useRef, useEffect } from 'react';

const useWebSocketCommand = ({ url }) => {
  const [ws, setWs] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const commandIdRef = useRef(0);
  const commandMap = useRef(new Map());

  const open = useCallback(() => {
    const webSocket = new WebSocket(url);
    webSocket.onopen = () => setIsActive(true);
    webSocket.onclose = () => setIsActive(false);
    webSocket.onmessage = event => {
      const { id, data, error } = JSON.parse(event.data);
      const command = commandMap.current.get(id);
      if (command) {
        error ? command.reject(error) : command.resolve(data);
        commandMap.current.delete(id);
      }
    };
    setWs(webSocket);
  }, [url]);

  const close = useCallback(() => {
    if (ws) {
      ws.close();
    }
  }, [ws]);

  const sendCommand = useCallback(
    (commandType, payload) => {
      return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject('WebSocket is not connected');
          return;
        }

        const id = commandIdRef.current++;
        commandMap.current.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, type: commandType, payload }));
      });
    },
    [ws],
  );

  const commands = {
    getScreenshot: () => sendCommand('screenshot', {}),
    click: (x, y) => sendCommand('click', { x, y }),
    input: param => sendCommand('input', param),
    ocr: param => sendCommand('ocr', param),
    play: pid => sendCommand('play', { pid }),
    pause: delay => sendCommand('pause', { delay }),
  };

  useEffect(() => {
    // 组件卸载时清理
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [ws]);

  return { open, close, commands, isActive };
};

export default useWebSocketCommand;
