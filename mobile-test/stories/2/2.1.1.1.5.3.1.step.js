step(
  {
    id: `2.1.1.1.5.3.1`,
    describe: `2.1.1 -> 2.1.1.1
2.1.1.1.3.1.1.1.1
`,
  },
  [],
  [],
  async (
    data,
    { platform, step, exe, getStore, setStore, reporter, parameter },
  ) => {
    await exe(['2.1.1', '2.1.1.1', '2.1.1.1.3.1.1.1.1']);
  },
);
