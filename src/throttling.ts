export async function processConcurrently<T>(
  maxConcurrentOp: number,
  getItems: () => AsyncGenerator<T>,
  processItem: (item: T) => Promise<void>,
): Promise<number> {
  const arr: Promise<number>[] = [];
  for (let i: number = 0; i < maxConcurrentOp; ++i) {
    arr.push(Promise.resolve(i));
  }

  let counter: number = 0;
  for await (const item of getItems()) {
    const completedIndex: number = await Promise.race(arr);
    arr[completedIndex] = processItem(item).then(() => {
      counter++;
      return completedIndex;
    });
  }

  await Promise.all(arr);
  return counter;
}
