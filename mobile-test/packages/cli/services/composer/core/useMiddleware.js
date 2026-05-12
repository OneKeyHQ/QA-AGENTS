let middlewares = [];

export const useMiddleware = middleware => {
  middlewares.push(middleware);
};

export const clear = () => {
  middlewares = [];
};

export default middlewares;
