# geoditor
Map GeoJSON geometry editor.

Supported features:
- `LineString`
- `Polygon`
- `MultiLineString`
- `MultiPolygon`
- `GeometryCollection` coming someday.

### Installing
```
npm install geoditor
```
```
yarn add geoditor
```

### Table of Content:
- [Initialising](##Initialising)
- [Using with MapBox](##Using with MapBox)
- [Getters and Setters](##Getters and Setters)
- [Events](##Events)
- [Tools](##Tools)

## Initialising
Geoditor is initialising with 2 types of modules.
1. __Controller__ _(required)_ to render features onto map. Provides API between Geoditor core and map implementation. Currently only [MapBox](#using-with-mapbox) is supported. 
2. __Tools__ _(optional)_ to edit data. If no tools is passed, default set will be used.

```ts
import { Geoditor, PenTool, MoveTool } from "geoditor";

const geoditor = new Geoditor({
  controller: {...}, 
  tools: {
    pen: new PenTool(),
    move: new MoveTool(),
  }
});
```

Any tool can be reused under different names with different settings (if supported). For example, multiple instances of Pen tool to create only lineal or polygonal geometries tools:
```
tools: {
  line: new PenTool({ types: ["LineString", "MultiLineString"]}),
  polygon: new PenTool({ types: ["Polygon", "MultiPolygon"] }),
}
```

## Using with [MapBox](https://github.com/mapbox/mapbox-gl-js)
```ts
import { Geoditor, MapboxController, PenTool, MoveTool } from "geoditor";
import { MapBox } from "mapbox-gl";

const mapbox = new MapBox({
  /* options */
  ...
});

const geoditor = new Geoditor({
  controller: new MapboxController(mapbox),
  ...
});
```

### Options
All options and optional. Use it only if you want to change rendering style or interactivity.
Both `config` and `layerStyles` are used for visual representation of the layers, and
`area` is used to define areas of interactivity.
<details>
<summary><strong>More info</strong></summary>

```ts
type Options = {
    config?: LayerConfig;
    layerStyles?: Omit<mapboxgl.Layer, "id">[];
    area?: {
        points?: number | false;
        lines?: number | false;
        planes?: false;
    };
}
```

#### layerStyles
If `layerStyles` is provided `config` will be ignored. Any layer type can be used but:
- `FillLayer` types are used to render `planes`
- `LineLayer` types are used to render `lines`.
- Every other layer will be used for rendering `points`.

Use the following feature-states to distinct features in different states:
`disabled`, `hover` or `active`

#### config
Config is used to generate mapbox.Layers for `planes`, `lines` and `points` separately.

```ts
type LayerConfig = {
    points: {
        type: mapboxgl.Layer["type"];
        paint: {
            // Feature states representation 
            default: mapboxgl.AnyPaint,
            /** Keep in mind that any paint properties key 
             * missing in "default" will be ignored */
            hover: mapboxgl.AnyPaint,
            active: mapboxgl.AnyPaint,
            disabled: mapboxgl.AnyPaint
        }
        layout?: mapboxgl.AnyLayout;
    },
    // lines and planes configs are the same 
    lines: {...},
    planes: {...}
}
```
[See example](https://github.com/graverok/geoditor/blob/0d6daefd8721b709e20f146f610884cd102bedf3/src/controllers/mapbox/config.ts#L53)
</details>

## Getters and Setters
### .data
You can access or set data at any given moment. `LineString`, `Polygon`, `MultiLineString`, and `MultiPolygon` are supported. Rest won't be deleted or changed in any way but will be ignored in render.

```ts
// Get features
const features = geoditor.data; 

// Set features
geoditor.data = [
  {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [[35.00, 50.00], [35.00, 51.00]],
    },
  },
]
```

### .selected
Access or set selected features indices.
```ts
// Get selection
const selected: number[] = geoditor.selected; 

// Set single/multiple selection 
geoditor.selected = [0];
geoditor.selected = [0, 1, 2];

// Select feature's shape
geoditor.selected = [[0]]
geoditor.selected = [[1, 0]] 

// Remove selection
geoditor.selected = [];
```

## Events

### .on("load")
Fires when Controller is initialized and ready. You can start working with Geoditor.
```ts
geoditor.on("load", () => {
  /** EXAMPLE: 
      Starts pen tool. Feature properties can be passed as argument. */
  geoditor.tools.pen({ color: "red" });
});
```

### .on("change")
Fires on data change. Array of GeoJSON features is passed into listener. If you had provided some data to Geoditor before all feature properties will be kept.
```ts
geoditor.on("change", (data: GeoJSON.Feature[]) => {
  // data === geoditor.data
  console.log(data, geoditor.data);
  
  /** EXAMPLE:
      Switch to "move" tool after drawing */
  if (geoditor.tool === "pen") geoditor.tools.move();
});
```
### .on("select") 
Fires on selected features change. Array of selected indices is passed into listener.
```ts
geoditor.on("select", (selected: number[]) => {
  /**
    selected !== geoditor.selected
    selected: number[] includes only indices of selected features
    geoditor.selected: (number | number[])[] returns selected shapes of features (if any)
   */
  console.log(selected, geoditor.selected);
});
```

### .on("render")
Fires every render. Can be used for simultaneous features update in a different source/map.

```ts
import * as mapboxgl from "mapbox-gl";

geoditor.on("render", (data: GeoJSON.Feature[]) => {
    // data !== geoditor.data 
    console.log(data, geoditor.data);

    // EXAMPLE:
    mapboxgl.getSource("some-source")?.setData(data)
});
```

## Tools
### Pen Tool

Different tools can be initialised with PenTool using different options:

|   Property   | Description                                                                                          | Type                                                                                                                                          | Default                                                        |
|:------------:|:-----------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------------------|:---------------------------------------------------------------|
|  __types__   | Types of created features                                                                            | `LineString` \| `Polygon` \| `MultiLineString` \| `MultiPolygon` \| `Array<"LineString" \| "Polygon" \| "MultiLineString" \| "MultiPolygon">` | `["LineString", "Polygon", "MultiLineString", "MultiPolygon"]` |
|  __append__  | Extends line geometry and converts single geometry to multi if corresponding types are provided.     | `boolean` \| `shift` \| `alt` \| `ctrl` \| `meta`                                                                                          | `true` | 
| __subtract__ | Subtract shapes from polygonal features.                                                             | `boolean` \| `shift` \| `alt` \| `ctrl` \| `meta`                                                                                          | `true` | 
|  __create__  | Add new features.                                                                                    | `boolean` \| `shift` \| `alt` \| `ctrl` \| `meta`                                                                                             | `true` | 

#### Examples
```ts
const PolygonTool = new PenTool({
  types: ["Polygon", "MultiPolygon"],
  append: "shift",
  subtract: "alt",
});

const AppendTool = new PenTool({
  create: false,
  subtract: false,
});
```

### Move Tool

You can provide key modifier to enable editing point mode. If no modifier is provided this mode enables by double click.

|  Property  | Description                                                                                | Type                                                 | Default |
|:----------:|:-------------------------------------------------------------------------------------------|:-----------------------------------------------------|:--------|
| __modify__ | Sets modifier key to activate point editing mode. If `true` second click enables this mode | `boolean` \| `dblclick` \| `alt` \| `ctrl` \| `meta` | `true`  | 
