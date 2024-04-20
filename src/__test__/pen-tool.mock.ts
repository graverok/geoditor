import { defineModes, PenToolConfig } from "../tools/pen-tool";
import { Feature } from "../types";

export const features: Feature[] = [
  {
    type: "LineString",
    nesting: [0],
    coordinates: [
      [0, 1],
      [0, 2],
    ],
  },
  {
    type: "MultiLineString",
    nesting: [1],
    coordinates: [
      [
        [1, 1],
        [1, 2],
      ],
      [
        [1, 3],
        [1, 4],
      ],
    ],
  },
  {
    type: "Polygon",
    nesting: [2],
    coordinates: [
      [
        [2, 1],
        [2, 2],
        [2, 3],
        [2, 4],
        [2, 1],
      ],
    ],
  },
  {
    type: "Polygon",
    nesting: [3],
    coordinates: [
      [
        [3, 1],
        [3, 2],
        [3, 3],
        [3, 4],
        [3, 1],
      ],
      [
        [3, 5],
        [3, 6],
        [3, 7],
        [3, 5],
      ],
    ],
  },
  {
    type: "MultiPolygon",
    nesting: [4],
    coordinates: [
      [
        [
          [4, 1],
          [4, 2],
          [4, 3],
          [4, 4],
          [4, 1],
        ],
      ],
      [
        [
          [4, 5],
          [4, 6],
          [4, 7],
          [4, 8],
          [4, 5],
        ],
      ],
    ],
  },
];

export const mapOptions = (
  config: PenToolConfig,
  state: { shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {},
) => ({
  "_": expect(defineModes(config, state, [], false)),
  "L": expect(defineModes(config, state, [features[0]], false)),
  "mL": expect(defineModes(config, state, [features[1]], false)),
  "P": expect(defineModes(config, state, [features[2]], false)),
  "mP": expect(defineModes(config, state, [features[4]], false)),
  "L+mL": expect(defineModes(config, state, [features[0], features[1]], false)),
  "L+P": expect(defineModes(config, state, [features[0], features[2]], false)),
  "L+mP": expect(defineModes(config, state, [features[0], features[4]], false)),
  "P+mL": expect(defineModes(config, state, [features[2], features[1]], false)),
  "P+mP": expect(defineModes(config, state, [features[2], features[4]], false)),
  "mL+mP": expect(defineModes(config, state, [features[1], features[4]], false)),
  "[L]": expect(defineModes(config, state, [features[0]], true)),
  "[mL]": expect(defineModes(config, state, [features[1]], true)),
  "[P]": expect(defineModes(config, state, [features[2]], true)),
  "[mP]": expect(defineModes(config, state, [features[4]], true)),
});

export const seac = { subtract: false, extend: false, append: false, create: false };
export const seaC = { subtract: false, extend: false, append: false, create: true };
export const seAc = { subtract: false, extend: false, append: true, create: false };
export const sEac = { subtract: false, extend: true, append: false, create: false };
export const sEaC = { subtract: false, extend: true, append: false, create: true };
export const sEAc = { subtract: false, extend: true, append: true, create: false };
export const Seac = { subtract: true, extend: false, append: false, create: false };
export const SeaC = { subtract: true, extend: false, append: false, create: true };
export const SeAc = { subtract: true, extend: false, append: true, create: false };
export const SEac = { subtract: true, extend: true, append: false, create: false };
export const SEaC = { subtract: true, extend: true, append: false, create: true };

export const mapModifiers = (
  config: PenToolConfig,
  callback: (payload: Record<string, ReturnType<typeof expect>>) => void,
) => {
  const { drawTypes, ...rest } = config;
  callback(mapOptions({ drawTypes, ...rest }, undefined));
  callback(mapOptions({ drawTypes, ...rest }, { altKey: true }));

  const e = Object.keys(rest)
    .filter((k) => (rest as any)[k] === false)
    .map((k) => k);
  const i = Object.keys(rest)
    .filter((k) => (rest as any)[k] === true)
    .map((k) => k);

  if (i.length === 3) {
    callback(
      mapOptions(
        { drawTypes, [i[0]]: "shiftKey", [i[1]]: "shiftKey", [i[2]]: "shiftKey" } as unknown as PenToolConfig,
        { shiftKey: true },
      ),
    );
  }

  if (e.length === 1 && i.length === 2) {
    callback(
      mapOptions({ drawTypes, [e[0]]: "shiftKey", [i[0]]: true, [i[1]]: true } as unknown as PenToolConfig, undefined),
    );
    callback(
      mapOptions({ drawTypes, [e[0]]: true, [i[0]]: "shiftKey", [i[1]]: "shiftKey" } as unknown as PenToolConfig, {
        shiftKey: true,
      }),
    );
    callback(
      mapOptions({ drawTypes, [e[0]]: "shiftKey", [i[0]]: true, [i[1]]: true } as unknown as PenToolConfig, {
        altKey: true,
      }),
    );
    callback(
      mapOptions({ drawTypes, [e[0]]: "shiftKey", [i[0]]: "altKey", [i[1]]: "altKey" } as unknown as PenToolConfig, {
        altKey: true,
      }),
    );
  }

  if (e.length === 2 && i.length === 1) {
    callback(
      mapOptions(
        { drawTypes, [e[0]]: "shiftKey", [e[1]]: "shiftKey", [i[0]]: true } as unknown as PenToolConfig,
        undefined,
      ),
    );
    callback(
      mapOptions({ drawTypes, [e[0]]: "ctrlKey", [e[1]]: "shiftKey", [i[0]]: "altKey" } as unknown as PenToolConfig, {
        altKey: true,
      }),
    );
    callback(
      mapOptions({ drawTypes, [e[0]]: true, [e[1]]: "shiftKey", [i[0]]: "altKey" } as unknown as PenToolConfig, {
        altKey: true,
      }),
    );
  }

  if (e.length === 3) {
    callback(
      mapOptions({ drawTypes, [i[0]]: "shiftKey", [i[1]]: "shiftKey", [i[2]]: "shiftKey" } as unknown as PenToolConfig),
    );
    callback(
      mapOptions(
        { drawTypes, [i[0]]: "shiftKey", [i[1]]: "shiftKey", [i[2]]: "shiftKey" } as unknown as PenToolConfig,
        { altKey: true },
      ),
    );
  }
};

export const check = (mapped: Record<string, ReturnType<typeof expect>>, options: string[], equality: typeof seac) => {
  options.forEach((o) => {
    mapped[o].toEqual(equality);
  });
};
