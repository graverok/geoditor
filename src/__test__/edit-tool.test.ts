import { handleSetActive } from "../tools/move-tool";

test("handleSetActive: Select feature from none", () => {
  const res = handleSetActive(false, [], [0, 1]);
  expect(res).toEqual({ active: [0] });
});

test("handleSetActive: Select feature from multiple included", () => {
  const res = handleSetActive(false, [0, 2], [0, 1]);
  const { release, ...rest } = res || {};
  expect(rest).toEqual({ active: [0, 2] });
  expect(release?.()).toEqual([0]);
});

test("handleSetActive: Select feature from another", () => {
  const res = handleSetActive(false, [1], [0, 1]);
  expect(res).toEqual({ active: [0] });
});

test("handleSetActive: Select feature from multiple another", () => {
  const res = handleSetActive(false, [1, 2], [0, 1]);
  expect(res).toEqual({ active: [0] });
});

test("handleSetActive: Select feature shape", () => {
  const res = handleSetActive(false, [0], [0, 1]);
  const { release, ...rest } = res || {};
  expect(rest).toEqual({ active: [0] });
  expect(release?.()).toEqual([[0, 1]]);
});

test("handleSetActive: Select feature shape from multiple shapes included", () => {
  const res = handleSetActive(
    false,
    [
      [0, 1],
      [1, 1],
    ],
    [0, 1],
  );
  const { release, ...rest } = res || {};
  expect(rest).toEqual({
    active: [
      [0, 1],
      [1, 1],
    ],
  });
  expect(release?.()).toEqual([[0, 1]]);
});

test("handleSetActive: Select feature shape from another shape", () => {
  const res = handleSetActive(
    false,
    [
      [0, 2],
      [1, 2],
    ],
    [0, 1],
  );
  expect(res).toEqual({ active: [[0, 1]] });
});

test("handleSetActive: Select feature shape from parent shape", () => {
  const res = handleSetActive(false, [[0, 1]], [0, 1, 2]);
  expect(res).toEqual({ active: [[0, 1, 2]] });
});

test("handleSetActive: Select feature shape from child shape", () => {
  const res = handleSetActive(false, [[0, 1, 2]], [0, 1]);
  expect(res).toEqual({ active: [[0, 1]] });
});

test("handleSetActive: Release to feature selection", () => {
  const res = handleSetActive(false, [[0, 1]], [0, 1]);
  const { release, ...rest } = res || {};
  expect(rest).toEqual({ active: [[0, 1]] });
  expect(release?.()).toEqual([0]);
});

test("handleSetActive: Ignore selection", () => {
  const res = handleSetActive(false, [[1, 2]], [0, 1]);
  expect(res).toBeUndefined();
});

test("handleSetActive: Multiple select feature from another", () => {
  const res = handleSetActive(true, [2], [0, 1]);
  expect(res).toEqual({ active: [2, 0] });
});

test("handleSetActive: Multiple select feature from same", () => {
  const res = handleSetActive(true, [0, 2], [0, 1]);
  const { release, ...rest } = res || {};
  expect(rest).toEqual({ active: [0, 2] });
  expect(release?.()).toEqual([2]);
});

test("handleSetActive: Keep selected shape", () => {
  const res = handleSetActive(true, [[0, 1]], [0, 1]);
  expect(res).toEqual({ active: [[0, 1]] });
});

test("handleSetActive: Add shape to multiple shape selection", () => {
  const res = handleSetActive(
    true,
    [
      [0, 2],
      [1, 1],
    ],
    [0, 1],
  );
  expect(res).toEqual({
    active: [
      [0, 2],
      [1, 1],
      [0, 1],
    ],
  });
});

test("handleSetActive: Add children shape to multiple shape selection", () => {
  const res = handleSetActive(
    true,
    [
      [0, 2],
      [1, 1],
    ],
    [0, 2, 1],
  );
  expect(res).toEqual({
    active: [
      [1, 1],
      [0, 2, 1],
    ],
  });
});

test("handleSetActive: Add parent shape to multiple shape selection", () => {
  const res = handleSetActive(
    true,
    [
      [0, 2, 1],
      [1, 1],
    ],
    [0, 2],
  );
  expect(res).toEqual({
    active: [
      [1, 1],
      [0, 2],
    ],
  });
});

test("handleSetActive: Remove shape to multiple shape selection", () => {
  const res = handleSetActive(
    true,
    [
      [0, 1],
      [1, 1],
    ],
    [0, 1],
  );
  const { release, ...rest } = res || {};

  expect(rest).toEqual({
    active: [
      [0, 1],
      [1, 1],
    ],
  });

  expect(release?.()).toEqual([[1, 1]]);
});

test("handleSetActive: Ignore selection", () => {
  const res = handleSetActive(
    true,
    [
      [1, 2],
      [2, 3],
    ],
    [0, 1],
  );
  expect(res).toBeUndefined();
});
