import { AnyTool, Core } from "../controllers";
import * as lib from "../lib";
import { DrawType, Feature, LayerType, Node, Polygon, Position, SourceEvent } from "../types";

export class PenTool extends AnyTool {
  private _geometry: Feature | undefined;
  private _ignoreMapEvents = false;
  private _isReversed = false;
  private _types: DrawType[] = [];
  private _resetCursor!: (() => void) | undefined;
  private _props: Record<string, any> | undefined;

  constructor(core: Core) {
    super(core);
    this._name = "pen";
    this._handleMapMouseMove = this._handleMapMouseMove.bind(this);
    this._handleMapClick = this._handleMapClick.bind(this);
    this._handleNodeEnter = this._handleNodeEnter.bind(this);
    this._handleNodeClick = this._handleNodeClick.bind(this);
    this._handleNodeMouseDown = this._handleNodeMouseDown.bind(this);
    this._renderEndings = this._renderEndings.bind(this);
  }

  private _renderEndings() {
    if (!this._geometry) {
      this.core.selectedNodes = [];
      return;
    }
    const { start, end, positions } = lib.getEndings(this._geometry, this._isReversed);

    if (Number(this._types.includes("LineString")) + positions.length >= 3) {
      this.core.selectedNodes = [
        ...(this._types.includes("Polygon") && positions.length >= 3
          ? [{ parentId: this._geometry.id, id: start }]
          : []),
        { parentId: this._geometry.id, id: end },
      ];
    }
  }

  private _setEndingNodes(features: Feature[]) {
    let nodes: Omit<Node, "position">[] = [];
    features.forEach((feature) => {
      if (feature?.type !== "LineString") return;
      const { start, end } = lib.getEndings(feature, this._isReversed);
      nodes = [...nodes, { parentId: feature.id, id: start }, { parentId: feature.id, id: end }];
    });
    this.core.selectedNodes = nodes;
  }

  private _render(feature: Feature, options: Partial<Record<LayerType, boolean | number[]>>) {
    this.core.render(
      [
        ...this.core.features.slice(0, this.core.selected[0] - 1),
        feature,
        ...this.core.features.slice(this.core.selected[0]),
      ],
      options,
    );
  }

  private _resetDraw() {
    this._isReversed = false;
    this._geometry = undefined;
    this.core.selectedNodes = [];
  }

  private _handleMapMouseMove(e: SourceEvent) {
    if (!this.core.hovered?.node) this._ignoreMapEvents = false;
    this.core.setCursor(this.core.hovered?.node && this._ignoreMapEvents ? "pointer" : "crosshair");
    if (this._ignoreMapEvents) return;

    if (!this._geometry) return;
    const positions = lib.getPoints(this._geometry);
    const asType = this._types.includes("LineString") || positions.length < 2 ? "LineString" : "Polygon";

    this._render(
      {
        ...this._geometry,
        type: asType,
        coordinates: lib.positions.toCoordinates(
          this._isReversed ? [e.position, ...positions] : [...positions, e.position],
          asType,
        ),
      } as Feature,
      { node: false },
    );
  }

  private _handleMapClick(e: SourceEvent) {
    if (this._ignoreMapEvents) return;

    if (this._geometry) {
      const positions = lib.getPoints(this._geometry);
      const asType = this._types.includes("LineString") || positions.length < 2 ? "LineString" : "Polygon";
      this._geometry = {
        ...this._geometry,
        type: "LineString",
        coordinates: this._isReversed ? [e.position, ...positions] : [...positions, e.position],
      };

      this._render(
        {
          ...this._geometry,
          type: asType,
          coordinates: lib.positions.toCoordinates(this._geometry.coordinates, asType),
        } as Feature,
        { node: this.core.selected },
      );
      this._renderEndings();

      if (this.core.selectedNodes.length) {
        const endNode = this.core.selectedNodes[this.core.selectedNodes.length - 1];
        this.core.setNodeState(endNode, { hovered: true });
        this.core.setCursor("pointer");
      }

      return;
    }

    const id = this.core.features.length + 1;

    this._geometry = {
      id,
      type: "LineString",
      coordinates: [Array.from(e.position)],
      props: this._props,
    } as Feature;

    this.core.selected = [id];
    this.core.render([...this.core.features, this._geometry], { node: this.core.selected });
    this.core.setFeatureState(id, { hovered: true });
    this.core.selectedNodes = [];
  }

  private _handleNodeEnter(e: SourceEvent) {
    const node = e.nodes[0];
    if (!node) return;
    if (!this.core.isNodeSelected(node)) return;
    this._ignoreMapEvents = true;

    if (!this._geometry) return;
    const positions = lib.getPoints(this._geometry);
    const { start, end } = lib.getEndings(this._geometry, this._isReversed);

    if (node.id === end && Number(this._types.includes("LineString")) + positions.length >= 3) {
      const asType = this._types.includes("LineString") || positions.length < 3 ? "LineString" : "Polygon";
      this._render(
        { ...this._geometry, type: asType, coordinates: lib.positions.toCoordinates(positions, asType) } as Feature,
        { node: false },
      );
    }

    if (positions.length >= 3 && this._types.includes("Polygon")) {
      start === node?.id &&
        this._render(
          {
            ...this._geometry,
            type: "Polygon",
            coordinates: lib.positions.toCoordinates(positions, "Polygon"),
          } as Feature,
          { node: false },
        );
    }

    const handleMouseLeave = () => {
      this._ignoreMapEvents = false;
      this.core.setNodeState(node, { hovered: false });
      this.core.removeListener("mouseleave", "node", handleMouseLeave);
    };

    this.core.setNodeState(node, { hovered: true });
    this.core.addListener("mouseleave", "node", handleMouseLeave);
  }

  private _handleNodeMouseDown(e: SourceEvent) {
    const node = e.nodes[0];
    if (!this.core.isNodeSelected(node)) return;
    this.core.setNodeState(node, { active: true });
    document.addEventListener("mouseup", () => this.core.setNodeState(node, { active: false }), { once: true });
  }

  private _handleNodeClick(e: SourceEvent) {
    if (this._geometry) {
      const node = e.nodes[0];
      if (!this.core.isNodeSelected(node)) return;
      this._ignoreMapEvents = true;

      const { start, positions } = lib.getEndings(this._geometry, this._isReversed);
      if (node.id === start || !this._types.includes("LineString")) {
        this._geometry = {
          ...this._geometry,
          type: "Polygon",
          coordinates: lib.positions.toCoordinates(positions, "Polygon") as Position[][],
        };
      }

      const feature = this._geometry;
      this._resetDraw();
      this.core.setNodeState(node, { hovered: false });

      this._setEndingNodes([feature]);
      this.core.features = [
        ...this.core.features.slice(0, this.core.selected[0] - 1),
        feature,
        ...this.core.features.slice(this.core.selected[0]),
      ];
    } else {
      const node = e.nodes[0];
      this._geometry = this.core.getFeature(node.parentId);

      if (!node || !this._geometry) return;
      this.core.selected = [this._geometry.id];
      this._isReversed = node.id === 1;
      this._renderEndings();
    }
  }

  get config() {
    return {
      types: this._types,
      isDrawing: Boolean(this._geometry),
    };
  }

  public refresh() {
    this._resetDraw();
    this.core.render(this.core.features, { node: this.core.selected });
    this._setEndingNodes(this.core.getSelectedFeatures());
  }

  public enable(options?: { type?: DrawType | DrawType[]; props?: Record<string, any> }) {
    this._props = options?.props;
    this._types = options?.type
      ? Array.isArray(options.type)
        ? options.type
        : [options.type]
      : ["LineString", "Polygon"];

    this._resetCursor = this.core.setCursor("default");
    this.core.render(this.core.features, { node: this.core.selected });
    this._setEndingNodes(this.core.getSelectedFeatures());

    this.core.addListener("mouseenter", "node", this._handleNodeEnter);
    this.core.addListener("mousedown", "node", this._handleNodeMouseDown);
    this.core.addListener("click", "node", this._handleNodeClick);
    this.core.addListener("mousemove", this._handleMapMouseMove);
    this.core.addListener("click", this._handleMapClick);
  }

  public disable() {
    let activeGeometry = this._geometry;
    this._resetDraw();

    this.core.removeListener("mousemove", this._handleMapMouseMove);
    this.core.removeListener("mousedown", "node", this._handleNodeMouseDown);
    this.core.removeListener("click", this._handleMapClick);
    this.core.removeListener("mouseenter", "node", this._handleNodeEnter);
    this.core.removeListener("click", "node", this._handleNodeClick);
    this._resetCursor?.();

    if (!activeGeometry) return;
    const positions = lib.getPoints(activeGeometry);

    if (positions.length < 2) return;
    const asType = this._types.includes("LineString") || positions.length < 3 ? "LineString" : "Polygon";

    this.core.features = [
      ...this.core.features.slice(0, this.core.selected[0] - 1),
      {
        ...activeGeometry,
        type: asType,
        coordinates: lib.positions.toCoordinates(positions, asType) as Position[][],
      } as Feature,
      ...this.core.features.slice(this.core.selected[0]),
    ];
  }
}
