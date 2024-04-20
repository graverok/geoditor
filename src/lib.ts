import { Feature, Position, Point, DrawType } from "./types";
import * as geojson from "geojson";

const getCoordinates = (feature: Feature | undefined, nesting: number[]): Position[] => {
  if (!feature) return [];
  if (feature.nesting[0] !== nesting[0]) return [];

  switch (feature.type) {
    case "LineString":
      if (nesting.length > 1 && nesting[1] > 0) return [];
      return Array.from(feature.coordinates);
    case "MultiLineString":
    case "Polygon":
      if (nesting.length < 1) return [];
      if (nesting.length > 2 && nesting[1] > 0) return [];
      return Array.from(feature.coordinates[nesting[1]] ?? []);
    case "MultiPolygon":
      if (nesting.length < 2) return [];
      return Array.from(feature.coordinates[nesting[1]]?.[nesting[2]] ?? []);
    default:
      return [];
  }
};

const traverseCoordinates = (
  feature: Feature,
  callback: (points: Position[], indices: number[]) => Position[] | void,
): Feature => {
  switch (feature.type) {
    case "LineString":
      return {
        ...feature,
        coordinates: callback(feature.coordinates, [...feature.nesting]) || feature.coordinates,
      };

    case "Polygon":
    case "MultiLineString":
      return {
        ...feature,
        coordinates: feature.coordinates.map(
          (positions, i) => callback(positions, [...feature.nesting, i]) || positions,
        ),
      };

    case "MultiPolygon":
      return {
        ...feature,
        coordinates: feature.coordinates.map((shapes, i) =>
          shapes.map((positions, j) => callback(positions, [...feature.nesting, i, j]) || positions),
        ),
      };
    default:
      return feature;
  }
};

const mutateFeature = (
  feature: Feature | undefined,
  nesting: number[],
  positions?: Position[] | ((current: Position[] | undefined) => Position[] | undefined),
  drawTypes: DrawType[] = ["LineString", "MultiLineString", "Polygon", "MultiPolygon"],
): Feature | undefined => {
  if (!feature) return undefined;
  if (feature.nesting[0] !== nesting[0]) return feature;
  const shapes = nesting.slice(1);

  const parse = (current?: Position[]): Position[][] => {
    if (!positions) return [];
    if (typeof positions === "function") {
      const res = positions(current || []);
      return res?.length ? [res] : [];
    }
    return positions?.length ? [positions] : [];
  };

  const _mutateLineString = (f: Feature<geojson.LineString> | Feature<geojson.MultiLineString>, c: Position[][]) => {
    if (c.length === 0) return undefined;
    if (c.length === 1 && drawTypes.includes("LineString"))
      return { ...f, type: "LineString", coordinates: c[0] } as Feature<geojson.LineString>;
    return { ...f, type: "MultiLineString", coordinates: c } as Feature<geojson.MultiLineString>;
  };

  const _mutatePolygon = (f: Feature<geojson.Polygon> | Feature<geojson.MultiPolygon>, c: Position[][][]) => {
    const r = c.filter((i) => i.length);
    if (r.length === 0) return undefined;
    if (r.length === 1 && drawTypes.includes("Polygon"))
      return { ...f, type: "Polygon", coordinates: r[0] } as Feature<geojson.Polygon>;
    return { ...f, type: "MultiPolygon", coordinates: r } as Feature<geojson.MultiPolygon>;
  };

  switch (feature.type) {
    case "LineString":
      return _mutateLineString(
        feature,
        shapes.length
          ? [...(feature.coordinates?.length ? [feature.coordinates].slice(0, shapes[0]) : []), ...parse()]
          : parse(feature.coordinates),
      );
    case "MultiLineString":
      return _mutateLineString(
        feature,
        shapes.length
          ? [
              ...(feature.coordinates || []).slice(0, shapes[0]),
              ...parse(feature.coordinates[shapes[0]]),
              ...(feature.coordinates || []).slice(shapes[0] + 1),
            ]
          : parse(),
      );

    case "Polygon":
      return _mutatePolygon(
        feature,
        shapes.length > 1
          ? [...[[...(feature.coordinates || [])]].slice(0, shapes[0]), parse()]
          : shapes.length
            ? [
                [
                  ...(feature.coordinates || []).slice(0, shapes[0]),
                  ...parse(feature.coordinates?.[shapes[0]]),
                  ...(feature.coordinates || []).slice(shapes[0] + 1),
                ],
              ]
            : [parse()],
      );

    case "MultiPolygon":
      return _mutatePolygon(
        feature,
        shapes.length > 1
          ? [
              ...(feature.coordinates ?? []).slice(0, shapes[0]),
              [
                ...(feature.coordinates?.[shapes[0]] ?? []).slice(0, shapes[1]),
                ...parse(feature.coordinates?.[shapes[0]]?.[shapes[1]]),
                ...(feature.coordinates?.[shapes[0]] ?? []).slice(shapes[1] + 1),
              ],
              ...(feature.coordinates ?? []).slice(shapes[0] + 1),
            ]
          : shapes.length
            ? [
                ...(feature.coordinates ?? []).slice(0, shapes[0]),
                parse(),
                ...(feature.coordinates ?? []).slice(shapes[0] + 1),
              ]
            : [parse()],
      );

    default:
      return feature;
  }
};

const createPoints = (features: Feature[], active?: (number | number[])[]) => {
  if (!active)
    return features.reduce((acc, feature) => {
      traverseCoordinates(feature, (positions, indices) => {
        toPositions(positions, feature.type).forEach((position, index) => {
          acc.push({
            coordinates: position,
            nesting: [...indices, index],
            props: feature.props,
          });
        });
      });

      return acc;
    }, [] as Point[]);

  return active.reduce((acc, nesting) => {
    const feature = features.find((f) => (Array.isArray(nesting) ? nesting[0] : nesting) === f.nesting[0]);
    if (!feature) return acc;

    traverseCoordinates(feature, (positions, indices) => {
      if (Array.isArray(nesting) && !array.equal(indices.slice(0, nesting.length), nesting)) return;
      toPositions(positions, feature.type).forEach((position, index) => {
        acc.push({
          coordinates: position,
          nesting: [...indices, index],
          props: feature.props,
        });
      });
    });

    return acc;
  }, [] as Point[]);
};

const toCoordinates = (positions: Position[], type?: Feature["type"]) => {
  switch (type) {
    case "Polygon":
    case "MultiPolygon":
      return [...positions, positions[0]];
    default:
      return positions;
  }
};

const toPositions = (coordinates: Position[], type?: Feature["type"]) => {
  switch (type) {
    case "Polygon":
    case "MultiPolygon":
      return coordinates.slice(0, coordinates.length - 1);
    default:
      return coordinates;
  }
};

const isPolygonLike = (feature: Feature) => {
  return feature.type === "Polygon" || feature.type === "MultiPolygon";
};

const coordinates = {
  move: (position: Position, from: Position, to: Position) => {
    return [position[0] + to[0] - from[0], position[1] + to[1] - from[1]];
  },
  average: (start: Position, end: Position) => {
    if (!start || !end) return start || end;
    return [(start[0] + end[0]) * 0.5, (start[1] + end[1]) * 0.5];
  },
  distance: (start: Position, end: Position): number => {
    if (!start || !end) return -1;
    return Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
  },
  normalize: (position: Position): Position => {
    let [lng, lat] = position;
    if (lat > 90) lat = 180 - lat;
    if (lat < -90) lat = -180 - lat;
    return [lng, lat];
  },
  geodesic: (position: Position, from: Position, to: Position) =>
    coordinates.normalize([
      to[0] -
        ((from[0] - position[0]) * Math.cos((position[1] / 180) * Math.PI)) /
          Math.cos(((position[1] + to[1] - from[1]) / 180) * Math.PI),
      position[1] + to[1] - from[1],
    ]),
};

const array = {
  equal: <T extends string | number | boolean>(a: T | (T | T[])[], b: T | (T | T[])[], partial = false): boolean => {
    if (typeof a !== "object" || typeof b !== "object") return a === b;
    if (a.length !== b.length && !partial) return false;
    return partial && a.length > b.length
      ? !b.some((x, i) => !array.equal(x, a[i], partial))
      : !a.some((x, i) => !array.equal(x, b[i], partial));
  },
  intersect: <T extends string | number | boolean>(a: T[], b: T[]): boolean => {
    return a.some((x) => b.includes(x));
  },
  plain: <T extends string | number | boolean>(a: T | T[]): T => {
    return Array.isArray(a) ? array.plain(a[0]) : a;
  },
  array: <T extends string | number | boolean>(a: T | T[]): T[] => {
    return Array.isArray(a) ? a : [a];
  },
};

export {
  isPolygonLike,
  createPoints,
  getCoordinates,
  toPositions,
  toCoordinates,
  traverseCoordinates,
  mutateFeature,
  coordinates,
  array,
};

type SvgProps = { shape: string; contour: string; translate?: { x: number; y: number } };
type AppendSvg = Record<string, undefined | SvgProps>;

const appendSvg: AppendSvg = {
  default: undefined,
  plus: {
    shape: `<path d="M24.2 20C24.0895 20 24 20.0895 24 20.2V24H20.2C20.0895 24 20 24.0895 20 24.2V24.8C20 24.9105 20.0895 25 20.2 25H24V28.8C24 28.9105 24.0895 29 24.2 29H24.8C24.9105 29 25 28.9105 25 28.8V25H28.8C28.9105 25 29 24.9105 29 24.8V24.2C29 24.0895 28.9105 24 28.8 24H25V20.2C25 20.0895 24.9105 20 24.8 20H24.2Z" stroke="none" />`,
    contour: `<path d="M26 19.5C26 19.2239 25.7761 19 25.5 19H23.5C23.2239 19 23 19.2239 23 19.5V22.5C23 22.7761 22.7761 23 22.5 23H19.5C19.2239 23 19 23.2239 19 23.5V25.5C19 25.7761 19.2239 26 19.5 26H22.5C22.7761 26 23 26.2239 23 26.5V29.5C23 29.7761 23.2239 30 23.5 30H25.5C25.7761 30 26 29.7761 26 29.5V26.5C26 26.2239 26.2239 26 26.5 26H29.5C29.7761 26 30 25.7761 30 25.5V23.5C30 23.2239 29.7761 23 29.5 23H26.5C26.2239 23 26 22.7761 26 22.5V19.5Z" />`,
  },
  minus: {
    shape: `<path d="M20 24.2C20 24.0895 20.0895 24 20.2 24H28.8C28.9105 24 29 24.0895 29 24.2V24.8C29 24.9105 28.9105 25 28.8 25H20.2C20.0895 25 20 24.9105 20 24.8V24.2Z" stroke="none"/>`,
    contour: `<rect x="19" y="23" width="11" height="3" rx="0.5" stroke="none"/>`,
  },
  disabled: {
    shape: `<path fill-rule="evenodd" clip-rule="evenodd" d="M30 24C30 27.3137 27.3137 30 24 30C20.6863 30 18 27.3137 18 24C18 20.6863 20.6863 18 24 18C27.3137 18 30 20.6863 30 24ZM29 24C29 26.7614 26.7614 29 24 29C22.7994 29 21.6976 28.5768 20.8356 27.8715L27.8715 20.8356C28.5768 21.6976 29 22.7994 29 24ZM27.1644 20.1285C26.3024 19.4232 25.2006 19 24 19C21.2386 19 19 21.2386 19 24C19 25.2006 19.4232 26.3024 20.1285 27.1644L27.1644 20.1285Z" stroke="none" fill="#EE4400"/>`,
    contour: `<path fill-rule="evenodd" clip-rule="evenodd" d="M31 24C31 27.866 27.866 31 24 31C20.134 31 17 27.866 17 24C17 20.134 20.134 17 24 17C27.866 17 31 20.134 31 24Z" stroke="none"/>`,
  },
  extend: {
    shape: `<g stroke="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M31 22C31 23.1046 30.1046 24 29 24C28.0681 24 27.285 23.3626 27.063 22.5H26.8125V21.5H27.063C27.285 20.6374 28.0681 20 29 20C30.1046 20 31 20.8954 31 22ZM30 22C30 22.5523 29.5523 23 29 23C28.4477 23 28 22.5523 28 22C28 21.4477 28.4477 21 29 21C29.5523 21 30 21.4477 30 22Z" /><path d="M23 22C23 22.5039 22.6273 22.9207 22.1425 22.9899L20.7859 26.3816C20.92 26.5517 21 26.7665 21 27C21 27.5523 20.5523 28 20 28C19.4477 28 19 27.5523 19 27C19 26.4961 19.3727 26.0793 19.8574 26.0101L21.2141 22.6184C21.08 22.4483 21 22.2335 21 22C21 21.4477 21.4477 21 22 21C22.5523 21 23 21.4477 23 22Z" /><path d="M23.3125 22.5H24.1875V21.5H23.3125V22.5Z" /><path d="M25.9375 22.5H25.0625V21.5H25.9375V22.5Z" /></g>`,
    contour: `<path fill-rule="evenodd" clip-rule="evenodd" d="M22.9013 23.7857C23.0543 23.7084 23.1958 23.6121 23.3228 23.5H27.6773C28.0293 23.8105 28.4922 24 29 24C30.1046 24 31 23.1046 31 22C31 20.8954 30.1046 20 29 20C28.4922 20 28.0293 20.1895 27.6773 20.5H23.3227C22.9707 20.1895 22.5078 20 22 20C20.8954 20 20 20.8954 20 22C20 22.2351 20.0409 22.4614 20.1158 22.6716L19.0987 25.2144C18.4468 25.544 18 26.2193 18 27C18 28.1046 18.8954 29 20 29C21.1046 29 22 28.1046 22 27C22 26.7649 21.9591 26.5386 21.8842 26.3284L22.9013 23.7857Z" stroke="none"/>`,
  },
  line: {
    shape: `<path fill-rule="evenodd" clip-rule="evenodd" d="M21 22C21 22.2335 21.08 22.4483 21.2141 22.6184L19.8574 26.0101C19.3727 26.0793 19 26.4961 19 27C19 27.5523 19.4477 28 20 28C20.5523 28 21 27.5523 21 27C21 26.7665 20.92 26.5517 20.7859 26.3816L22.1425 22.9899C22.4521 22.9457 22.7159 22.7598 22.8662 22.5H28.1338C28.3067 22.7989 28.6299 23 29 23C29.5523 23 30 22.5523 30 22C30 21.4477 29.5523 21 29 21C28.6299 21 28.3067 21.2011 28.1338 21.5H22.8662C22.6933 21.2011 22.3701 21 22 21C21.4477 21 21 21.4477 21 22Z" stroke="none"/>`,
    contour: `<path fill-rule="evenodd" clip-rule="evenodd" d="M22.9013 23.7857C23.0543 23.7084 23.1958 23.6121 23.3228 23.5H27.6773C28.0293 23.8105 28.4922 24 29 24C30.1046 24 31 23.1046 31 22C31 20.8954 30.1046 20 29 20C28.4922 20 28.0293 20.1895 27.6773 20.5H23.3227C22.9707 20.1895 22.5078 20 22 20C20.8954 20 20 20.8954 20 22C20 22.2351 20.0409 22.4614 20.1158 22.6716L19.0987 25.2144C18.4468 25.544 18 26.2193 18 27C18 28.1046 18.8954 29 20 29C21.1046 29 22 28.1046 22 27C22 26.7649 21.9591 26.5386 21.8842 26.3284L22.9013 23.7857Z" stroke="none"/>`,
  },
  polygon: {
    shape: `<path fill-rule="evenodd" clip-rule="evenodd" d="M21.5 22.8662C21.2011 22.6933 21 22.3701 21 22C21 21.4477 21.4477 21 22 21C22.3701 21 22.6933 21.2011 22.8662 21.5H28.1338C28.3067 21.2011 28.6299 21 29 21C29.5523 21 30 21.4477 30 22C30 22.5039 29.6273 22.9207 29.1425 22.9899L27.7859 26.3816C27.92 26.5517 28 26.7665 28 27C28 27.5523 27.5523 28 27 28C26.6299 28 26.3067 27.7989 26.1338 27.5H22.8662C22.6933 27.7989 22.3701 28 22 28C21.4477 28 21 27.5523 21 27C21 26.6299 21.2011 26.3067 21.5 26.1338V22.8662ZM26.8575 26.0101C26.5479 26.0543 26.2841 26.2402 26.1338 26.5H22.8662C22.7784 26.3482 22.6518 26.2216 22.5 26.1338V22.8662C22.6518 22.7784 22.7784 22.6518 22.8662 22.5H28.1338C28.1578 22.5415 28.1846 22.581 28.2141 22.6184L26.8575 26.0101Z" stroke="none"/>`,
    contour: `<path fill-rule="evenodd" clip-rule="evenodd" d="M29.9013 23.7856C30.5532 23.456 31 22.7807 31 22C31 20.8954 30.1046 20 29 20C28.4922 20 28.0293 20.1895 27.6773 20.5H23.3227C22.9707 20.1895 22.5078 20 22 20C20.8954 20 20 20.8954 20 22C20 22.5078 20.1895 22.9707 20.5 23.3227V25.6773C20.1895 26.0293 20 26.4922 20 27C20 28.1046 20.8954 29 22 29C22.5078 29 22.9707 28.8105 23.3227 28.5H25.6773C26.0293 28.8105 26.4922 29 27 29C28.1046 29 29 28.1046 29 27C29 26.7649 28.9591 26.5386 28.8842 26.3284L29.9013 23.7856ZM26.0987 25.2143C25.9457 25.2916 25.8042 25.3879 25.6772 25.5H23.5V23.5H26.7845L26.0987 25.2143Z" stroke="none"/>`,
  },
  point: {
    shape: `<circle cx="24.5" cy="24.5" r="2" stroke="none"/>`,
    contour: `<circle cx="24.5" cy="24.5" r="3.5" stroke="none"/>`,
  },
};

const transform = (props: SvgProps | undefined, content: string) => {
  if (!props?.translate) return content;
  return `<g transform="translate(${props.translate.x},${props.translate.y})">${content}</g>`;
};

export const createCursor = (
  base: { shape: string; contour: string; translate?: { x: number; y: number } },
  key: string,
  color = "black",
) => {
  const append = appendSvg[key as keyof AppendSvg];
  const svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="${color}" stroke="${color}" xmlns="http://www.w3.org/2000/svg">
    <filter id="dropshadow" height="150%" width="150%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1"/>
      <feOffset dx="0.4" dy="0.8" result="offsetblur"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.32"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    ${[base, append].map((item) =>
      item
        ? transform(
            item,
            `<g fill="#FFFFFF" stroke="none" style="filter:url(#dropshadow)">${item.contour}</g>${item.shape}`,
          )
        : "",
    )}
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};
