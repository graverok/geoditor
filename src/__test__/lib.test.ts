import {
  coords1,
  coords2,
  coords3,
  featureLine,
  featureMultiLine,
  featureMultiPolygon,
  featurePolygon,
  insertion,
} from "./lib.mock";

const lib = require("../lib");

test("lib.mutateFeature", () => {
  expect(lib.mutateFeature(featureLine, [1])).toBe(featureLine);
  expect(lib.mutateFeature(featureLine, [0])).toBeUndefined();
  expect(lib.mutateFeature(featureLine, [0], [])).toBeUndefined();
  expect(lib.mutateFeature(featureLine, [0], insertion)).toEqual({ ...featureLine, coordinates: insertion });
  expect(lib.mutateFeature(featureLine, [0, 4])).toEqual(featureLine);
  expect(lib.mutateFeature(featureLine, [0, 4], [])).toEqual(featureLine);
  expect(lib.mutateFeature(featureLine, [0, 4], insertion)).toEqual({
    ...featureLine,
    type: "MultiLineString",
    coordinates: [coords1, insertion],
  });
  expect(lib.mutateFeature(featureLine, [0, 0], insertion)).toEqual({
    ...featureLine,
    coordinates: insertion,
  });

  expect(lib.mutateFeature(featureMultiLine, [1])).toBe(featureMultiLine);
  expect(lib.mutateFeature(featureMultiLine, [0])).toBeUndefined();
  expect(lib.mutateFeature(featureMultiLine, [0], [])).toBeUndefined();
  expect(lib.mutateFeature(featureMultiLine, [0], insertion)).toEqual({
    ...featureLine,
    coordinates: insertion,
  });
  expect(lib.mutateFeature(featureMultiLine, [0, 0])).toEqual({ ...featureLine, coordinates: coords2 });
  expect(lib.mutateFeature(featureMultiLine, [0, 1])).toEqual({ ...featureLine, coordinates: coords1 });
  expect(lib.mutateFeature(featureMultiLine, [0, 4])).toEqual(featureMultiLine);
  expect(lib.mutateFeature(featureMultiLine, [0, 4], [])).toEqual(featureMultiLine);
  expect(lib.mutateFeature(featureMultiLine, [0, 4], insertion)).toEqual({
    ...featureMultiLine,
    coordinates: [coords1, coords2, insertion],
  });

  expect(lib.mutateFeature(featurePolygon, [1])).toBe(featurePolygon);
  expect(lib.mutateFeature(featurePolygon, [0])).toBeUndefined();
  expect(lib.mutateFeature(featurePolygon, [0], [])).toBeUndefined();
  expect(lib.mutateFeature(featurePolygon, [0], insertion)).toEqual({
    ...featurePolygon,
    coordinates: [insertion],
  });
  expect(lib.mutateFeature({ ...featurePolygon, coordinates: undefined }, [0], insertion)).toEqual({
    ...featurePolygon,
    coordinates: [insertion],
  });
  expect(lib.mutateFeature({ ...featurePolygon, coordinates: undefined }, [0, 0], insertion)).toEqual({
    ...featurePolygon,
    coordinates: [insertion],
  });
  expect(lib.mutateFeature(featurePolygon, [0, 0])).toEqual({
    ...featurePolygon,
    coordinates: [coords2, coords3],
  });
  expect(lib.mutateFeature(featurePolygon, [0, 0], insertion)).toEqual({
    ...featurePolygon,
    coordinates: [insertion, coords2, coords3],
  });
  expect(lib.mutateFeature(featurePolygon, [0, 1], insertion)).toEqual({
    ...featurePolygon,
    coordinates: [coords1, insertion, coords3],
  });
  expect(lib.mutateFeature(featurePolygon, [0, 5], insertion)).toEqual({
    ...featurePolygon,
    coordinates: [coords1, coords2, coords3, insertion],
  });
  expect(lib.mutateFeature(featurePolygon, [0, 0, 0], insertion)).toEqual({
    ...featurePolygon,
    type: "Polygon",
    coordinates: [insertion],
  });
  expect(lib.mutateFeature(featurePolygon, [0, 0, 1], insertion)).toEqual({
    ...featurePolygon,
    type: "Polygon",
    coordinates: [insertion],
  });
  expect(lib.mutateFeature(featurePolygon, [0, 2, 0], insertion)).toEqual({
    ...featurePolygon,
    type: "MultiPolygon",
    coordinates: [[coords1, coords2, coords3], [insertion]],
  });
  expect(lib.mutateFeature(featurePolygon, [0, 2, 1], insertion)).toEqual({
    ...featurePolygon,
    type: "MultiPolygon",
    coordinates: [[coords1, coords2, coords3], [insertion]],
  });

  expect(lib.mutateFeature(featureMultiPolygon, [1])).toBe(featureMultiPolygon);
  expect(lib.mutateFeature(featureMultiPolygon, [0])).toBeUndefined();
  expect(lib.mutateFeature(featureMultiPolygon, [0], [])).toBeUndefined();
  expect(lib.mutateFeature(featureMultiPolygon, [0], insertion)).toEqual({
    ...featurePolygon,
    coordinates: [insertion],
  });
  expect(lib.mutateFeature(featureMultiPolygon, [0, 0], [])).toEqual({
    ...featurePolygon,
    coordinates: [coords3],
  });
  expect(lib.mutateFeature(featureMultiPolygon, [0, 0], insertion)).toEqual({
    ...featureMultiPolygon,
    coordinates: [[insertion], [coords3]],
  });
  expect(lib.mutateFeature(featureMultiPolygon, [0, 1], [])).toEqual({
    ...featurePolygon,
    coordinates: [coords1, coords2],
  });
  expect(lib.mutateFeature(featureMultiPolygon, [0, 1], insertion)).toEqual({
    ...featureMultiPolygon,
    coordinates: [[coords1, coords2], [insertion]],
  });
  expect(lib.mutateFeature(featureMultiPolygon, [0, 4], insertion)).toEqual({
    ...featureMultiPolygon,
    coordinates: [[coords1, coords2], [coords3], [insertion]],
  });
  expect(lib.mutateFeature(featureMultiPolygon, [0, 0, 0], [])).toEqual({
    ...featureMultiPolygon,
    coordinates: [[coords2], [coords3]],
  });
  expect(lib.mutateFeature(featureMultiPolygon, [0, 0, 1], [])).toEqual({
    ...featureMultiPolygon,
    coordinates: [[coords1], [coords3]],
  });
  expect(lib.mutateFeature(featureMultiPolygon, [0, 1, 0], [])).toEqual({
    ...featurePolygon,
    coordinates: [coords1, coords2],
  });
  expect(lib.mutateFeature(featureMultiPolygon, [0, 1, 1], [])).toEqual(featureMultiPolygon);
  expect(lib.mutateFeature(featureMultiPolygon, [0, 1, 0], insertion)).toEqual({
    ...featureMultiPolygon,
    coordinates: [[coords1, coords2], [insertion]],
  });
  expect(lib.mutateFeature(featureMultiPolygon, [0, 0, 0], insertion)).toEqual({
    ...featureMultiPolygon,
    coordinates: [[insertion, coords2], [coords3]],
  });
  expect(lib.mutateFeature(featureMultiPolygon, [0, 1, 1], insertion)).toEqual({
    ...featureMultiPolygon,
    coordinates: [
      [coords1, coords2],
      [coords3, insertion],
    ],
  });
  expect(lib.mutateFeature(featureMultiPolygon, [0, 0, 4], insertion)).toEqual({
    ...featureMultiPolygon,
    coordinates: [[coords1, coords2, insertion], [coords3]],
  });
  expect(lib.mutateFeature(featureMultiPolygon, [0, 2], [])).toEqual(featureMultiPolygon);
  expect(lib.mutateFeature(featureMultiPolygon, [0, 2], insertion)).toEqual({
    ...featureMultiPolygon,
    coordinates: [[coords1, coords2], [coords3], [insertion]],
  });
  expect(lib.mutateFeature(featureMultiPolygon, [0, 3, 5], insertion)).toEqual({
    ...featureMultiPolygon,
    coordinates: [[coords1, coords2], [coords3], [insertion]],
  });
});

test("lib.array.equal", () => {
  expect(lib.array.equal(0, 0)).toBeTruthy();
  expect(lib.array.equal([0], [0])).toBeTruthy();
  expect(lib.array.equal([0, 1], [0, 1])).toBeTruthy();
  expect(lib.array.equal([[0, 1]], [[0, 1]])).toBeTruthy();
  expect(lib.array.equal([1, [0, 1]], [1, [0, 1]])).toBeTruthy();
  expect(
    lib.array.equal(
      [
        [0, 1],
        [0, 2],
      ],
      [
        [0, 1],
        [0, 2],
      ],
    ),
  ).toBeTruthy();
  expect(lib.array.equal([[0, 1, 2]], [[0, 1]], true)).toBeTruthy();
  expect(
    lib.array.equal(
      [
        [0, 1, 2],
        [0, 2, 2],
      ],
      [[0, 1], [0]],
      true,
    ),
  ).toBeTruthy();
  expect(lib.array.equal([1, [0, 1]], [1, [0]], true)).toBeTruthy();

  expect(lib.array.equal(0, 1)).toBeFalsy();
  expect(lib.array.equal([0], [1])).toBeFalsy();
  expect(lib.array.equal([[0, 1], [1]], [[1], [0, 1]])).toBeFalsy();
  expect(lib.array.equal([0, [1]], [[0], [1]])).toBeFalsy();

  expect(lib.array.equal(undefined, undefined)).toBeTruthy();
  expect(lib.array.equal([undefined], undefined)).toBeFalsy();
});
