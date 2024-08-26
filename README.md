# geoditor
Map GeoJSON geometry editor.

Supported features:
- `LineString`
- `Polygon`
- `MultiLineString`
- `MultiPolygon`
- `GeometryCollection` coming soon.

### Installing
```
npm install geoditor
```
```
yarn add geoditor
```

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
  line: new PenTool({ drawTypes: ["LineString", "MultiLineString"]}),
  polygon: new PenTool({ drawTypes: ["Polygon", "MultiPolygon"] }),
}
```

## Using with [MapBox](https://github.com/mapbox/mapbox-gl-js)
```ts
import { Geoditor, MapboxController, PenTool, MoveTool } from "geoditor";
import { MapBox } from "mapbox-gl";

const mapbox = new MapBox({
  /* Your config */
  ...
});

const geoditor = new Geoditor({
  controller: new MapboxController(mapbox),
  ...
});
```

## Getters & Setters
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
Fires on data update. Array of GeoJSON features is passed into listener. If you passed some data to Geoditor before it will only change features geometry and properties passed to Pen tool.  
```ts
geoditor.on("change", (data: GeoJSON.Feature[]) => {
  // data === geoditor.data
  console.log(data, geoditor.data);
  
  /** EXAMPLE:
      Switch to "move" tool after drawing */
  geoditor.tool === "pen" && geoditor.tools.move();
});
```
### .on("select") 
Fires on selected features change. Array of selected indices is passed into listener.
```ts
geoditor.on("select", (selected: number[]) => {
  /* 
    selected !== geoditor.selected
    selected: number[] includes only indices of selected features
    geoditor.selected: (number | number[])[] returns selected shapes of features (if any)
   */
  console.log(selected, geoditor.selected);
});
```

## Tools
### Pen Tool

Different tools can be initialised with PenTool using different options:

| Property     | Description                                                                                                    | Type                                                                                                                                          | Default                                                        |
|:------------:|:---------------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------------------|:---------------------------------------------------------------|
| __drawType__ | Types of created features                                                                                      | `LineString` \| `Polygon` \| `MultiLineString` \| `MultiPolygon` \| `Array<"LineString" \| "Polygon" \| "MultiLineString" \| "MultiPolygon">` | `["LineString", "Polygon", "MultiLineString", "MultiPolygon"]` |
| __append__   | Ability to extend line geometry and convert single geometry to multi if corresponding draw types are provided. | `boolean` \| `shiftKey` \| `altKey` \| `ctrlKey` \| `metaKey` | `true` | 
| __subtract__ | Ability to subtract shapes from polygonal features.                                                            | `boolean` \| `shiftKey` \| `altKey` \| `ctrlKey` \| `metaKey` | `true` | 
| __create__   | Ability to add new features.                                                                                   | `boolean` \| `shiftKey` \| `altKey` \| `ctrlKey` \| `metaKey` | `true` | 

#### Examples
```ts
const PolygonTool = new PenTool({
  drawTypes: ["Polygon", "MultiPolygon"],
  append: "shiftKey",
  subtract: "altKey",
});

const AppendTool = new PenTool({
  create: false,
  subtract: false,
});
```
