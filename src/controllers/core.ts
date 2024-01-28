import { isEqual } from "../lib";
import { RenderEvent, RenderEventHandler, Source, RenderFeature, RenderController } from "./source";
import { LayerType, GeometryFeature, NodeFeature, Position, DataItem } from "../types";

export class Core implements RenderController {
  private _source: Source;
  private _nodes: NodeFeature[] = [];
  private _selected: number[] = [];
  private _hovered: Partial<Record<LayerType, number | undefined>> | undefined;
  public addListener;
  public removeListener;
  public setFeatureState;
  public setCursor;
  public updateData;
  public modifyFeatures;
  private _onSelect!: ((indices: number[]) => void) | undefined;

  constructor(props: { source: Source; onSelect?: (indices: number[]) => void }) {
    this._source = props.source;
    this._onSelect = props.onSelect;
    this.addListener = this._source.addListener;
    this.removeListener = this._source.removeListener;
    this.setFeatureState = this._source.setFeatureState;
    this.setCursor = this._source.setCursor;
    this.updateData = this._source.updateData;
    this.modifyFeatures = this._source.modifyFeatures;
  }

  public getFeature(id?: number) {
    return this._source.getFeature(id);
  }

  public init() {
    this.initHandlers();
    this.render(this.features);
  }

  public reset() {
    this.selected = [];
    this._hovered = undefined;
  }

  get hovered() {
    return this._hovered;
  }

  private _setHovered(type: LayerType, id?: number) {
    this._hovered = {
      ...this._hovered,
      [type]: id,
    };

    if (!Object.values(this._hovered).some((v) => v)) {
      this._hovered = undefined;
    }
  }

  set selected(ids: number[]) {
    if (isEqual(ids, this._selected)) return;

    const prev = Array.from(this._selected);
    this._selected = Array.from(ids);

    prev.forEach((id) => !ids.includes(id) && this.setFeatureState(["fill", "line"], id, { selected: false }));
    ids.forEach((id) => !prev.includes(id) && this.setFeatureState(["fill", "line"], id, { selected: true }));
    this.render(this._source.features);

    this._onSelect?.(this._selected.map((id) => id - 1));
  }

  get selected() {
    return this._selected;
  }

  protected handleGeometryEnter(e: RenderEvent) {
    const features = e.features;
    const layer = features[0].layer;
    if (!features || !layer) return;
    let ids = features.reduce((acc, f) => [...acc, f.id], [] as number[]);
    this._setHovered(layer, ids[0]);

    const handleMouseMove: RenderEventHandler = (ev) => {
      ids = ev.features.reduce(
        (acc, f) => (f.id ? (ids.includes(+f.id) ? [...acc, +f.id] : [+f.id, ...acc]) : acc),
        [] as number[],
      );
      this._setHovered(layer, ids[0]);
    };

    const handleMouseLeave: RenderEventHandler = () => {
      this._setHovered(layer);
      this._source.removeListener("mousemove", layer, handleMouseMove);
      this._source.removeListener("mouseleave", layer, handleMouseLeave);
    };

    this._source.addListener("mousemove", layer, handleMouseMove);
    this._source.addListener("mouseleave", layer, handleMouseLeave);
  }

  private renderNodes() {
    this._source.render("node", this._nodes as RenderFeature[]);
  }

  public getNode(id?: number) {
    return this._nodes.find((node) => node.id === id);
  }

  get features() {
    return this._source.features;
  }

  set features(features: GeometryFeature[]) {
    this._source.features = features;
  }

  set value(data: DataItem[]) {
    this._source.value = data;
  }

  public getSelectedFeatures() {
    return this._source.features.filter((item) => this._selected.includes(item.id));
  }

  public addNode(id: number, position: Position | undefined, properties: Partial<NodeFeature["properties"]>) {
    if (!id) return;
    if (!position) return;
    const current = this.getNode(id);

    if (current) {
      if (isEqual(current.geometry.coordinates, position)) return;
      this._nodes = this._nodes.filter((node) => node.id !== id);
    }

    this._nodes = [
      ...this._nodes,
      {
        id,
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: position,
        },
        properties: {
          featureId: properties.featureId ?? 0,
          before: properties.before ?? 0,
          after: properties.after ?? 0,
        },
      },
    ];

    this.renderNodes();
  }

  public removeNode(id?: number) {
    if (!id) return;
    if (!this.getNode(id)) return;
    this._source.setFeatureState(["node"], id, { hovered: false, selected: false, active: false });
    this._nodes = this._nodes.filter((node) => node.id !== +id);
    this.renderNodes();
  }

  public clearNodes() {
    this._nodes.forEach((node) => this.removeNode(node.id));
    this._nodes = [];
    this.renderNodes();
  }

  private initHandlers() {
    this._source.addListener("mouseenter", "node", this.handleGeometryEnter.bind(this));
    this._source.addListener("mouseenter", "point", this.handleGeometryEnter.bind(this));
    this._source.addListener("mouseenter", "line", this.handleGeometryEnter.bind(this));
    this._source.addListener("mouseenter", "fill", this.handleGeometryEnter.bind(this));
  }

  get renderer() {
    return this._source.renderer;
  }

  public refresh() {
    this.render(this._source.features);
    this.clearNodes();
  }

  public render(features: GeometryFeature[], options?: Partial<Record<LayerType, boolean | number[]>>) {
    const { point = true, line = true, fill = true } = options || {};
    const foreground = this._hovered
      ? [this._hovered.point || this._hovered.line || this._hovered.fill]
      : this._selected;
    const sorted = [
      ...features.filter((feature) => !foreground.includes(feature.id)),
      ...features.filter((feature) => foreground.includes(feature.id)),
    ] as RenderFeature[];

    fill && this._source.render("fill", Array.isArray(fill) ? sorted.filter((item) => fill.includes(item.id)) : sorted);
    line && this._source.render("line", Array.isArray(line) ? sorted.filter((item) => line.includes(item.id)) : sorted);
    point &&
      this._source.render(
        "point",
        sorted.filter((item) => (Array.isArray(point) ? point : this._selected).includes(item.id)),
      );
  }

  public remove() {
    this._source.removeListener("mouseenter", "node", this.handleGeometryEnter);
    this._source.removeListener("mouseenter", "point", this.handleGeometryEnter);
    this._source.removeListener("mouseenter", "line", this.handleGeometryEnter);
    this._source.removeListener("mouseenter", "fill", this.handleGeometryEnter);
    this._source.remove();
  }
}
