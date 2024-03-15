export const insertion = [
  [10, 1],
  [10, 2],
];
export const coords1 = [
  [0, 1],
  [0, 2],
];
export const coords2 = [
  [1, 1],
  [2, 2],
];
export const coords3 = [
  [2, 1],
  [3, 2],
];

export const featureLine = {
  type: "LineString",
  nesting: [0],
  coordinates: coords1,
};

export const featureMultiLine = {
  type: "MultiLineString",
  nesting: [0],
  coordinates: [coords1, coords2],
};

export const featurePolygon = {
  type: "Polygon",
  nesting: [0],
  coordinates: [coords1, coords2, coords3],
};

export const featureMultiPolygon = {
  type: "MultiPolygon",
  nesting: [0],
  coordinates: [[coords1, coords2], [coords3]],
};
