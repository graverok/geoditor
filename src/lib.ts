import { GeometryFeature, Polygon, Position } from "./types";

const getDistanceToLine = (point: Position, [start, end]: [Position, Position]) => {
  const a = point[0] - start[0];
  const b = point[1] - start[1];
  const c = end[0] - start[0];
  const d = end[1] - start[1];

  const dot = a * c + b * d;
  const len_sq = c * c + d * d;
  let param = -1;
  if (len_sq != 0)
    //in case of 0 length line
    param = dot / len_sq;

  let xx, yy;

  if (param < 0) {
    xx = start[0];
    yy = start[1];
  } else if (param > 1) {
    xx = end[0];
    yy = end[1];
  } else {
    xx = start[0] + param * c;
    yy = start[1] + param * d;
  }

  const dx = point[0] - xx;
  const dy = point[1] - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

const getClosestLine = function (feature: GeometryFeature | undefined, point: Position) {
  const positions = getPoints(feature);
  if (feature?.type === "Polygon") positions.push(positions[0]);
  const { index } = positions.slice(1).reduce(
    (acc: { index: number; delta?: number }, item, index) => {
      const delta = getDistanceToLine(point, [positions[index], item]);
      return typeof acc.delta !== "number" || delta < acc.delta ? { index, delta } : acc;
    },
    { index: -1 },
  );

  return {
    before: index + 1,
    after: index + 2,
    position: positionTools.average(positions[index], positions[index + 1]),
  };
};

// const getClosestPoint = (feature: GeometryFeature, position: Position) => {
//   const positions = getPositions(feature);
//   let distance: number | undefined;
//
//   return positions.reduce(
//     (
//       acc: {
//         id: number;
//         before: number;
//         after: number;
//         position?: Position;
//       },
//       item,
//       index,
//     ) => {
//       const nextDistance = getDistanceToPoint(position, item);
//       if (typeof distance !== "number" || nextDistance < distance) {
//         distance = nextDistance;
//         return {
//           id: index + 1,
//           current: index + 1,
//           before: index > 0 ? index : feature.type === "Polygon" ? positions.length - 1 : 0,
//           after:
//             feature.type === "Polygon"
//               ? index < positions.length - 2
//                 ? index + 2
//                 : 1
//               : index < positions.length - 1
//                 ? index + 2
//                 : 0,
//           position: item,
//         };
//       }
//       return acc;
//     },
//     { id: 0, before: 0, after: 0 },
//   );
// };

/**
 * Converts positions to geometry coordinates
 */
const getCoordinates = (positions: Position[], type: GeometryFeature["type"]): GeometryFeature["coordinates"] => {
  switch (type) {
    case "Polygon":
      return [[...positions, positions[0]]];
    default:
      return positions;
  }
};

/**
 * Return unique points to render nodes
 */
const getPoints = (feature?: GeometryFeature): Position[] => {
  if (!feature) return [];
  switch (feature.type) {
    case "Polygon":
      return [...feature.coordinates[0].slice(0, feature.coordinates[0].length - 1)];
    default:
      return [...feature.coordinates];
  }
};

/**
 * Return ids of first and last nodes of the line
 */
const getEndings = (feature: GeometryFeature | undefined, isReversed: boolean) => {
  const positions = getPoints(feature);

  return {
    end: isReversed ? 1 : positions.length,
    start: !isReversed ? 1 : positions.length,
    positions,
  };
};

/**
 * Converts LineString to Polygon
 * Probably is redundant
 */
const createPolygon = (feature?: GeometryFeature): Polygon["coordinates"] => {
  const positions = getPoints(feature);
  return [[...positions, positions[0]]];
};
export const geometryTools = {
  getPoints,
  getEndings,
  getCoordinates,
  getClosestLine,
  // getClosestPoint,
  createPolygon,
};

export const positionTools = {
  subtract: (start: Position, end: Position) => {
    if (!start || !end) return start || end;
    return [end[0] - start[0], end[1] - start[1]] as Position;
  },
  add: (start: Position, end: Position) => {
    if (!start || !end) return start || end;
    return [end[0] + start[0], end[1] + start[1]] as Position;
  },
  average: (start: Position, end: Position) => {
    if (!start || !end) return start || end;
    return [(start[0] + end[0]) * 0.5, (start[1] + end[1]) * 0.5];
  },
  equal: (start: Position, end: Position) => {
    if (!start || !end) return false;
    return start[0] === end[0] && start[1] === end[1];
  },
  distance: (start: Position, end: Position): number => {
    if (!start || !end) return -1;
    return Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
  },
};
