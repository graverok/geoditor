import { AnyTool, Core } from "../controllers";
import { geometryTools } from "../lib";
import { DrawMode, DrawType, GeometryFeature, Node, Polygon, SourceEvent } from "../types";

export class CreateTool extends AnyTool {
  private _activeNodes: Omit<Node, "position">[] = [];
  private _ignoreMapEvents = false;
  private _isReversed = false;
  private _isDrawing = false;
  private _types: DrawType[] = [];
  private _mode: DrawMode | undefined;
  private _resetCursor!: (() => void) | undefined;
  private _props: Record<string, any> | undefined;

  constructor(core: Core) {
    super(core);
    this._name = "create";
    this._handleMapMouseMove = this._handleMapMouseMove.bind(this);
    this._handleMapClick = this._handleMapClick.bind(this);
    this._handleNodeEnter = this._handleNodeEnter.bind(this);
    this._handleNodeClick = this._handleNodeClick.bind(this);
  }

  get config() {
    return {
      types: this._types,
      mode: this._mode,
      isDrawing: this._isDrawing,
    };
  }

  private _setActiveNodes(payload: Omit<Node, "position">[]) {
    this._activeNodes.forEach((current) => {
      if (payload.some((node) => node.id === current.id && node.parentId === current.parentId)) return;
      this.core.setNodeState(current.parentId, current.id, { selected: false });
    });

    payload.forEach((node) => this.core.setNodeState(node.parentId, node.id, { selected: true }));
    this._activeNodes = payload;
  }

  private _resetDraw() {
    this._isDrawing = false;
    this._isReversed = false;

    this._setActiveNodes([]);
    this.core.render(this.core.features, { node: this.core.selected });
  }

  private _handleMapMouseMove(e: SourceEvent) {
    this.core.setCursor(this.core.hovered?.node && this._ignoreMapEvents ? "pointer" : "crosshair");

    if (this._ignoreMapEvents) return;
    if (!this._isDrawing) return;

    this.core.render(
      this.core.modifyFeatures(this.core.selected, (positions) =>
        this._isReversed ? [e.position, ...positions] : [...positions, e.position],
      ),
      { fill: false, node: false },
    );
  }

  private _handleMapClick(e: SourceEvent) {
    if (this._ignoreMapEvents) {
      this._ignoreMapEvents = false;
      return;
    }

    if (this._isDrawing) {
      const featureId = this.core.selected[0];

      this.core.features = this.core.modifyFeatures(this.core.selected, (positions) =>
        this._isReversed ? [e.position, ...positions] : [...positions, e.position],
      );
      this.core.render(this.core.features, { fill: !this._types.includes("LineString"), node: this.core.selected });

      const params = geometryTools.getEndings(this.core.getFeature(featureId), this._isReversed);
      const activeNodes: typeof this._activeNodes = [];

      if (this._types.includes("Polygon") && params.positions.length >= 3) {
        activeNodes.push({ parentId: featureId, id: params.start });
      }

      if (this._types.includes("LineString") && params.positions.length >= 2) {
        activeNodes.push({ parentId: featureId, id: params.end });
        this.core.setNodeState(featureId, params.end, { hovered: true });
        this.core.setCursor("pointer");
      }

      this._setActiveNodes(activeNodes);
      return;
    }

    const id = this.core.features.length + 1;
    this.core.features = [
      ...this.core.features,
      {
        id,
        type: "LineString",
        coordinates: [Array.from(e.position)],
        props: this._props,
      },
    ];

    this.core.selected = [id];
    this.core.setFeatureState(id, { hovered: true });
    this.core.render(this.core.features, { node: this.core.selected });
    this._setActiveNodes([]);
    this._isDrawing = true;
  }

  private _handleNodeEnter(e: SourceEvent) {
    const node = e.nodes[0];
    const feature = this.core.getFeature(node?.parentId);
    if (!node || !feature) return;

    this._ignoreMapEvents = this._activeNodes.some(
      (active) => active.parentId === node.parentId && active.id === node.id,
    );

    if (!this._isDrawing) return;

    const { start, end } = geometryTools.getEndings(feature, this._isReversed);
    if (this._types.includes("LineString")) {
      if (end === node?.id) {
        this._ignoreMapEvents = true;
        this.core.render(this.core.features, { node: false });
      }
    }

    if (this._types.includes("Polygon")) {
      if (start === node?.id) {
        this._ignoreMapEvents = true;
        this.core.render(
          this.core.modifyFeatures([feature.id], (positions) => [...positions, positions[0]]),
          { node: false },
        );
      }
    }

    const handleMouseLeave = () => {
      this._ignoreMapEvents = false;
      this.core.removeListener("mouseleave", "node", handleMouseLeave);
    };

    this.core.addListener("mouseleave", "node", handleMouseLeave);
  }

  private _handleNodeClick(e: SourceEvent) {
    if (this._isDrawing) {
      const node = e.nodes[0];
      const feature = this.core.getFeature(node?.parentId);
      if (!feature || !node) return;
      if (!this._activeNodes.some((active) => active.parentId === node.parentId && active.id === node.id)) return;
      this._ignoreMapEvents = true;

      const { start } = geometryTools.getEndings(feature, this._isReversed);
      node.id === start && this._selectedToPolygon();
      this._resetDraw();
      this.core.setNodeState(node.parentId, node.id, { hovered: true });
      this.core.updateData();
    } else {
      const node = e.nodes[0];
      const feature = this.core.getFeature(node.parentId);

      if (!node || !feature) return;
      this.core.selected = [feature.id];
      this._isReversed = node.id === 1;
      this._isDrawing = true;

      const params = geometryTools.getEndings(this.core.getFeature(feature.id), this._isReversed);
      const activeNodes: typeof this._activeNodes = [];

      if (this._types.includes("Polygon") && params.positions.length >= 3) {
        activeNodes.push({ parentId: feature.id, id: params.start });
      }

      if (this._types.includes("LineString") && params.positions.length >= 2) {
        activeNodes.push({ parentId: feature.id, id: params.end });
        this.core.setCursor("pointer");
      }
      this._setActiveNodes(activeNodes);
    }
  }

  private _selectedToPolygon() {
    const feature = this.core.getSelectedFeatures()[0];
    if (feature) {
      this.core.features = this.core.features.map((f) =>
        f.id === feature.id
          ? ({
              ...feature,
              type: "Polygon",
              coordinates: geometryTools.createPolygon(feature),
            } as GeometryFeature<Polygon>)
          : f,
      );
    }
  }

  public refresh() {
    this._isDrawing && this._resetDraw();
  }

  public enable(options?: { mode?: DrawMode; type?: DrawType | DrawType[]; props?: Record<string, any> }) {
    this._mode = options?.mode || "create";
    this._props = options?.props;
    this._types = options?.type
      ? Array.isArray(options.type)
        ? options.type
        : [options.type]
      : ["LineString", "Polygon"];

    this._resetCursor = this.core.setCursor("default");
    this.core.render(this.core.features, { node: this.core.selected });

    this.core.selected.forEach((id) => {
      const feature = this.core.getFeature(id);
      if (feature?.type !== "LineString") return;
      const { start, end } = geometryTools.getEndings(feature, this._isReversed);
      this._setActiveNodes([
        { parentId: feature.id, id: start },
        { parentId: feature.id, id: end },
      ]);
    });

    this.core.addListener("click", "node", this._handleNodeClick);
    this.core.addListener("mouseenter", "node", this._handleNodeEnter);
    this.core.addListener("mousemove", this._handleMapMouseMove);
    this.core.addListener("click", this._handleMapClick);
  }

  public disable() {
    const isDrawing = this._isDrawing;
    this._resetDraw();

    this.core.removeListener("mousemove", this._handleMapMouseMove);
    this.core.removeListener("click", this._handleMapClick);
    this.core.removeListener("mouseenter", "node", this._handleNodeEnter);
    this.core.removeListener("click", "node", this._handleNodeClick);
    this._resetCursor?.();

    if (!isDrawing) return;
    const positions = geometryTools.getPoints(this.core.getSelectedFeatures()[0]);
    if (positions.length > 1) {
      positions.length >= 3 && !this._types.includes("LineString") && this._selectedToPolygon();
      this.core.updateData();
    } else {
      this.core.features = [
        ...this.core.features.slice(0, this.core.selected[0] - 1),
        ...this.core.features.slice(0, this.core.selected[0]),
      ];
      this.core.render(this.core.features, { node: this.core.selected });
    }
  }
}
