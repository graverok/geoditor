import { AnyPaint, Layer } from "mapbox-gl";

export type AddSourcePayload = {
  id: string;
  layers: Omit<Layer, "id">[];
  areaLayer?: Omit<Layer, "id">;
};

export type PaintConfigParams = {
  type: Layer["type"];
  default: { [key in keyof AnyPaint]: AnyPaint[key] };
  selected?: { [key in keyof AnyPaint]: AnyPaint[key] };
  hovered?: { [key in keyof AnyPaint]: AnyPaint[key] };
  active?: { [key in keyof AnyPaint]: AnyPaint[key] };
};

export type PaintConfig = PaintConfigParams[];

export type Options = {
  paintConfig?: PaintConfig;
  layerStyles?: Layer[];
  pointArea?: number;
  lineArea?: number;
};

export const areaPointLayer = {
  type: "circle",
  paint: {
    "circle-radius": 8,
    "circle-color": "#FF0000",
    "circle-opacity": 0,
  },
};

export const areaLineLayer = {
  type: "line",
  paint: {
    "line-width": 10,
    "line-color": "#0000FF",
    "line-opacity": 0,
  },
};

export const areaFillLayer = {
  type: "fill",
  paint: {
    "fill-color": "#00FF00",
    "fill-opacity": 0,
  },
};

export const defaultConfig: PaintConfig = [
  {
    type: "fill",
    default: {
      "fill-color": ["get", "color"],
      "fill-opacity": 0.1,
    },
  },
  {
    type: "line",
    default: {
      "line-width": 1.5,
      "line-color": ["get", "color"],
      "line-opacity": 0.8,
    },
    selected: {
      "line-width": 2,
      "line-opacity": 1,
    },
    hovered: {
      "line-width": 2,
      "line-opacity": 1,
    },
    active: {
      "line-width": 2,
      "line-opacity": 1,
    },
  },
  {
    type: "circle",
    default: {
      "circle-radius": 2,
      "circle-stroke-width": 2,
      "circle-color": "#FFFFFF",
      "circle-stroke-color": ["get", "color"],
    },
    selected: {
      "circle-color": ["get", "color"],
      "circle-stroke-color": "#FFFFFF",
      "circle-radius": 2.5,
    },
    hovered: {
      "circle-stroke-color": ["get", "color"],
      "circle-color": "#FFFFFF",
      "circle-radius": 2.5,
    },
    active: {
      "circle-stroke-color": "#FFFFFF",
      "circle-color": ["get", "color"],
      "circle-radius": 2.5,
    },
  },
];

const parser = (value: string | number | any[] | any[][]) => {
  if (Array.isArray(value) && Array.isArray(value[0])) {
    return value;
  } else {
    return [value];
  }
};

export const generateLayers = (config: PaintConfig): Omit<Layer, "id">[] => {
  return config.map((item) => {
    const paintKeys = Object.keys(item.default);

    return {
      type: item.type as any,
      paint: (paintKeys as Array<keyof AnyPaint>).reduce((acc, key) => {
        return {
          ...acc,
          [key]: [
            "case",
            ["boolean", ["feature-state", "active"], false],
            ...parser(item.active?.[key] || item.hovered?.[key] || item.selected?.[key] || item.default[key]),
            // ["all", ["feature-state", "selected"], ["feature-state", "hovered"]],
            // ...parser(item.selected?.[key] || item.hovered?.[key] || item.default[key]),
            ["boolean", ["feature-state", "hovered"], false],
            ...parser(item.hovered?.[key] || item.default[key]),
            ["boolean", ["feature-state", "selected"], false],
            ...parser(item.selected?.[key] || item.default[key]),
            ...parser(item.default[key]),
          ],
        };
      }, {} as AnyPaint),
    };
  });
};

export const splitLayers = (layers: Omit<Layer, "id">[]) =>
  layers.reduce(
    (acc, layer) => {
      switch (layer.type) {
        case "line":
          acc[1].push(layer);
          break;
        case "fill":
          acc[2].push(layer);
          break;
        default:
          acc[0].push(layer);
      }
      return acc;
    },
    [[], [], []] as Omit<Layer, "id">[][],
  );
