import { AnyTool, Core } from "../controllers";
import * as lib from "../lib";
import { DrawType, Feature, Node, Polygon, Position, SourceEvent } from "../types";

export class PenTool extends AnyTool {
  private _geometry: Position[] | undefined;
  private _indices: number[] = [];
  private _ignoreMapEvents = false;
  private _isReversed = false;
  private _types: DrawType[] = [];
  private _resetCursor!: (() => void) | undefined;
  private _props: Record<string, any> | undefined;

  constructor(core: Core) {
    super(core);
    this._name = "pen";
    this._handleCanvasMouseMove = this._handleCanvasMouseMove.bind(this);
    this._handleCanvasClick = this._handleCanvasClick.bind(this);
    this._handlePointMouseEnter = this._handlePointMouseEnter.bind(this);
    this._handlePointClick = this._handlePointClick.bind(this);
    this._handlePointMouseDown = this._handlePointMouseDown.bind(this);
    this._renderActiveNodes = this._renderActiveNodes.bind(this);
    this._handleCanvasLeave = this._handleCanvasLeave.bind(this);
  }

  private _renderActiveNodes() {
    if (!this._geometry) {
      this.core.selectedNodes = [];
      return;
    }
    if (
      Number(this._types.includes("LineString") || this._types.includes("MultiLineString")) + this._geometry.length >=
      3
    ) {
      this.core.selectedNodes = [
        ...(this._types.includes("Polygon") && this._geometry.length >= 3
          ? [{ fid: this.core.selected[0], indices: [...this._indices, 0] }]
          : []),
        { fid: this.core.selected[0], indices: [...this._indices, this._geometry.length - 1] },
      ];
    }
  }

  private _setEndingNodes(features: Feature[]) {
    let nodes: Omit<Node, "position">[] = [];
    features.forEach((feature) => {
      if (!feature) return;
      if (feature.type !== "LineString" && feature.type !== "MultiLineString") return;
      const positions = lib.getPoints(feature);
      if (feature.type === "LineString") {
        nodes = [...nodes, { fid: feature.id, indices: [0] }, { fid: feature.id, indices: [positions.length - 1] }];
      }
    });
    this.core.selectedNodes = nodes;
  }

  private _render(options?: { node?: Node; placeholder?: Position }) {
    const { node, placeholder } = options ?? {};
    if (!this.core.selected[0]) return;
    if (!this._geometry) return;
    let asType: DrawType = "LineString";

    if (!node) {
      asType =
        this._types.includes("LineString") || this._geometry.length + Number(Boolean(placeholder)) < 3
          ? "LineString"
          : "Polygon";
    } else {
      const pidx = node.indices.length - 1;
      if (
        node.indices[pidx] === this._geometry.length - 1 &&
        Number(this._types.includes("LineString")) + this._geometry.length >= 3
      )
        asType = this._types.includes("LineString") || this._geometry.length < 3 ? "LineString" : "Polygon";
      if (node?.indices[pidx] === 0 && this._geometry.length >= 3 && this._types.includes("Polygon"))
        asType = "Polygon";
    }

    this.core.render(
      [
        ...this.core.features.slice(0, this.core.selected[0] - 1),
        {
          id: this.core.selected[0],
          type: asType,
          coordinates: lib.positions.toCoordinates([...this._geometry, ...(placeholder ? [placeholder] : [])], asType),
        } as Feature,
        ...this.core.features.slice(this.core.selected[0]),
      ],
      { point: node || placeholder ? false : this.core.selected },
    );
  }

  private _resetDraw() {
    this._isReversed = false;
    this._geometry = undefined;
    this._indices = [];
    this.core.selectedNodes = [];
  }

  private _handleCanvasMouseMove(e: SourceEvent) {
    if (!this.core.hovered?.point) this._ignoreMapEvents = false;
    this.core.setCursor(this.core.hovered?.point && this._ignoreMapEvents ? "pointer" : "crosshair");
    if (this._ignoreMapEvents) return;

    if (!this._geometry) return;

    this._render({ placeholder: e.position });
  }

  private _handleCanvasClick(e: SourceEvent) {
    if (this._ignoreMapEvents) return;

    if (this._geometry) {
      this.core.selectedNodes = [];
      this._geometry = [...this._geometry, e.position];
      this._render();
      if (this._indices.length === 0 && !this._types.includes("LineString") && this._geometry.length >= 3) {
        this._indices = [0];
      }
      this._renderActiveNodes();

      if (this.core.selectedNodes.length) {
        this.core.setNodeState(
          { fid: this.core.selected[0], indices: [...this._indices, this._geometry.length - 1] },
          { hovered: true },
        );
        this.core.setCursor("pointer");
      }
      return;
    }

    const id = this.core.features.length + 1;
    this._geometry = [e.position];
    this.core.selected = [id];
    this._render();
    this.core.setFeatureState(this.core.selected[0], { hovered: true });
    this.core.selectedNodes = [];
  }

  private _handlePointMouseEnter(e: SourceEvent) {
    const node = e.nodes[0];
    if (!node) return;
    if (!this.core.isNodeSelected(node)) return;
    this._ignoreMapEvents = true;
    if (!this._geometry) return;
    this._render({ node });

    const handleMouseLeave = () => {
      this._ignoreMapEvents = false;
      this.core.setNodeState(node, { hovered: false });
      this.core.removeListener("mouseleave", "point", handleMouseLeave);
    };

    this.core.setNodeState(node, { hovered: true });
    this.core.addListener("mouseleave", "point", handleMouseLeave);
  }

  private _handlePointMouseDown(e: SourceEvent) {
    const node = e.nodes[0];
    if (!this.core.isNodeSelected(node)) return;
    this.core.setNodeState(node, { active: true });
    document.addEventListener("mouseup", () => this.core.setNodeState(node, { active: false }), { once: true });
  }

  private _handlePointClick(e: SourceEvent) {
    const node = e.nodes[0];
    if (!node) return;
    const pidx = node.indices.length - 1;

    if (this._geometry) {
      if (!this.core.isNodeSelected(node)) return;
      this._ignoreMapEvents = true;

      const asType: DrawType =
        node.indices[pidx] === 0 || !this._types.includes("LineString") ? "Polygon" : "LineString";
      if (this._isReversed) this._geometry.reverse();
      const feature = {
        id: this.core.selected[0],
        type: asType,
        coordinates: lib.positions.toCoordinates(this._geometry, asType),
      } as Feature;

      this._resetDraw();
      this.core.setNodeState(node, { hovered: false });
      this._setEndingNodes([feature]);

      this.core.features = [
        ...this.core.features.slice(0, this.core.selected[0] - 1),
        feature,
        ...this.core.features.slice(this.core.selected[0]),
      ];
    } else {
      this._indices = node.indices.slice(0, pidx);
      const feature = this.core.getFeature(node.fid);
      this._geometry = lib.getGeometry(this._indices, lib.getPoints(feature));
      if (feature?.type === "MultiLineString") {
        this._types = ["MultiLineString"];
      }

      if (feature?.type === "LineString" && !this._types.includes("LineString")) {
        this._indices = [0, ...this._indices];
      }

      this.core.selected = [node.fid];
      if (node.indices[pidx] === 0) {
        this._isReversed = true;
        this._geometry.reverse();
        this._render();
      }
      this._renderActiveNodes();
    }
  }

  private _handleCanvasLeave() {
    if (!this._geometry) return;

    this._render();
  }

  get config() {
    return {
      types: this._types,
      isDrawing: Boolean(this._geometry),
    };
  }

  public refresh() {
    this._resetDraw();
    this.core.render(this.core.features, { point: this.core.selected });
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
    this.core.render(this.core.features, { point: this.core.selected });
    this._setEndingNodes(this.core.getSelectedFeatures());

    this.core.addListener("mouseenter", "point", this._handlePointMouseEnter);
    this.core.addListener("mousedown", "point", this._handlePointMouseDown);
    this.core.addListener("click", "point", this._handlePointClick);
    this.core.addListener("mousemove", this._handleCanvasMouseMove);
    this.core.addListener("click", this._handleCanvasClick);
    this.core.addListener("mouseout", this._handleCanvasLeave);
  }

  public disable() {
    let activeGeometry = this._geometry;
    if (this._isReversed) activeGeometry?.reverse();
    this._resetDraw();

    this.core.removeListener("mouseout", this._handleCanvasLeave);
    this.core.removeListener("mousemove", this._handleCanvasMouseMove);
    this.core.removeListener("mousedown", "point", this._handlePointMouseDown);
    this.core.removeListener("click", this._handleCanvasClick);
    this.core.removeListener("mouseenter", "point", this._handlePointMouseEnter);
    this.core.removeListener("click", "point", this._handlePointClick);
    this._resetCursor?.();

    if (!activeGeometry) return;
    if (activeGeometry.length < 2) return;

    const asType = this._types.includes("LineString") || activeGeometry.length < 3 ? "LineString" : "Polygon";
    this.core.features = [
      ...this.core.features.slice(0, this.core.selected[0] - 1),
      {
        id: this.core.selected[0],
        type: asType,
        coordinates: lib.positions.toCoordinates(activeGeometry, asType) as Position[][],
      } as Feature,
      ...this.core.features.slice(this.core.selected[0]),
    ];
  }
}
