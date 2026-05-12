import { useState, useEffect, useRef } from 'react';

const useInterval = (callback, delay, startImmediately = false) => {
  const [intervalId, setIntervalId] = useState(null);
  const savedCallback = useRef();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
  };

  const start = () => {
    stop();
    const id = setInterval(() => {
      savedCallback.current();
    }, delay);
    setIntervalId(id);
  };

  if (startImmediately) {
    start();
  }

  const clear = () => {
    clearInterval(intervalId);
  };

  return { start, stop, clear };
};

export default useInterval;
