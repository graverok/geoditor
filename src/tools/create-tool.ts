import { AnyTool, Core, RenderEvent } from "../controllers";
import { geometryTools } from "../lib";
import { DrawMode, DrawType, Geometry, Position } from "../types";

export class CreateTool extends AnyTool {
  private isReversed = false;
  private isDrawing = false;
  private types: DrawType[] = [];
  private mode: DrawMode | undefined;
  private resetCursor!: (() => void) | undefined;

  constructor(core: Core) {
    super(core);
    this._name = "create";
    this.handleMapMouseMove = this.handleMapMouseMove.bind(this);
    this.handleMapClick = this.handleMapClick.bind(this);
    this.handleNodeEnter = this.handleNodeEnter.bind(this);
    this.handleNodeClick = this.handleNodeClick.bind(this);
  }

  get config() {
    return {
      types: this.types,
      mode: this.mode,
      isDrawing: this.isDrawing,
    };
  }

  private resetDraw() {
    this.isDrawing = false;
    this.isReversed = false;
    this.core.clearNodes();
  }

  private addClosingNodes(featureId: number, payload: { start: number; end: number; positions: Position[] }) {
    const { start, end, positions } = payload;
    this.types.includes("Polygon") &&
      positions.length >= 3 &&
      this.core.addNode(start, positions[start - 1], { featureId });
    this.core.setFeatureState(["node"], start, { selected: true });

    if (this.types.includes("LineString") && positions.length >= 2) {
      this.core.addNode(end, positions[end - 1], { featureId });
      this.core.setFeatureState(["node"], end, { selected: true, active: true });
      this.core.setCursor("pointer");
    }
  }

  handleMapMouseMove(e: RenderEvent) {
    this.core.setCursor(this.core.hovered?.node ? "pointer" : "crosshair");

    if (this.isDrawing) {
      if (this.core.hovered?.node) return;
      this.core.render(
        this.core.modifyFeatures(this.core.selected, (positions) =>
          this.isReversed ? [e.position, ...positions] : [...positions, e.position],
        ),
        { fill: false, point: false },
      );
    }
  }

  handleMapClick(e: RenderEvent) {
    if (this.isDrawing) {
      const featureId = this.core.selected[0];
      const params = geometryTools.getEndings(this.core.getFeature(featureId)?.geometry, this.isReversed);

      this.core.features = this.core.modifyFeatures(this.core.selected, (positions) =>
        this.isReversed ? [e.position, ...positions] : [...positions, e.position],
      );
      this.core.render(this.core.features, { fill: !this.types.includes("LineString") });

      const nextParams = geometryTools.getEndings(this.core.getFeature(featureId)?.geometry, this.isReversed);
      params.start !== nextParams.start && this.core.removeNode(params.start);
      params.end !== nextParams.end && this.core.removeNode(params.end);
      this.addClosingNodes(featureId, nextParams);

      return;
    }

    if (this.core.hovered?.node) return;
    const id = this.core.features.length + 1;
    this.core.features = [
      ...this.core.features,
      {
        id,
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [Array.from(e.position)],
        } as Geometry,
        properties: null,
      },
    ];

    this.core.selected = [id];
    this.core.setFeatureState(["line", "fill"], id, { hovered: true });
    this.core.render(this.core.features);
    this.core.clearNodes();
    this.isDrawing = true;
  }

  handleNodeEnter(e: RenderEvent) {
    if (!this.isDrawing) return;
    const nodeFeature = e.features[0];
    if (!nodeFeature) return;
    const editFeature = this.core.getSelectedFeatures()[0];
    if (!editFeature) return;

    const { start, end } = geometryTools.getEndings(editFeature.geometry, this.isReversed);
    if (this.types.includes("LineString")) {
      if (end === nodeFeature?.id) {
        this.core.render(this.core.features, { point: false });
        this.core.setFeatureState(["node"], nodeFeature.id, { active: true });
      }
    }

    if (this.types.includes("Polygon")) {
      if (start === nodeFeature?.id) {
        this.core.render(
          this.core.modifyFeatures([editFeature.id], (positions) => [...positions, positions[0]]),
          { point: false },
        );
        this.core.setFeatureState(["node"], nodeFeature.id, { active: true });
      }
    }

    const handleMouseLeave = () => {
      this.core.setFeatureState(["node"], nodeFeature.id, { active: false });
      this.core.removeListener("mouseleave", "node", handleMouseLeave);
    };

    this.core.addListener("mouseleave", "node", handleMouseLeave);
  }

  handleNodeClick(e: RenderEvent) {
    if (!this.isDrawing) {
      const nodeFeature = this.core.getNode(e.features[0]?.id);
      const editFeature = this.core.getFeature(nodeFeature?.properties.featureId);
      if (!nodeFeature || !editFeature) return;
      this.core.selected = [editFeature.id];
      this.isReversed = nodeFeature.id % 2 === 1;
      this.isDrawing = true;
      this.core.clearNodes();
      this.addClosingNodes(editFeature.id, geometryTools.getEndings(editFeature.geometry, this.isReversed));
    } else {
      const nodeFeature = e.features[0];
      if (!nodeFeature) return;
      this.resetDraw();

      this.core.features = this.core.modifyFeatures(this.core.selected, (positions) =>
        this.isReversed ? positions.slice(1) : positions.slice(0, positions.length - 1),
      );
      const { start } = geometryTools.getEndings(this.core.getSelectedFeatures()[0]?.geometry, this.isReversed);
      nodeFeature.id === start && this.selectedToPolygon();
      this.core.render(this.core.features);
      this.core.updateData();
    }
  }

  public enable(options?: { mode?: DrawMode; type?: DrawType | DrawType[] }) {
    this.mode = options?.mode || "create";
    this.types = options?.type
      ? Array.isArray(options.type)
        ? options.type
        : [options.type]
      : ["LineString", "Polygon"];

    this.resetCursor = this.core.setCursor("default");

    this.core.selected.forEach((id, index) => {
      const editFeature = this.core.getFeature(id);
      if (editFeature?.geometry.type !== "LineString") return;
      const { start, end, positions } = geometryTools.getEndings(editFeature.geometry, this.isReversed);
      this.core.addNode(index * 2 + 1, positions[start - 1], { featureId: id });
      this.core.addNode(index * 2 + 2, positions[end - 1], { featureId: id });
      this.core.setFeatureState(["node"], index * 2 + 1, { selected: true });
      this.core.setFeatureState(["node"], index * 2 + 2, { selected: true });
    });

    this.core.addListener("mousemove", this.handleMapMouseMove);
    this.core.addListener("click", this.handleMapClick);
    this.core.addListener("mouseenter", "node", this.handleNodeEnter);
    this.core.addListener("click", "node", this.handleNodeClick);
  }

  private selectedToPolygon() {
    const feature = this.core.getSelectedFeatures()[0];
    if (feature) {
      this.core.features = this.core.features.map((f) =>
        f.id === feature.id
          ? {
              ...feature,
              geometry: geometryTools.createPolygon(feature.geometry),
            }
          : f,
      );
    }
  }

  public refresh() {
    this.isDrawing && this.resetDraw();
  }

  public disable() {
    const isDrawing = this.isDrawing;
    this.resetDraw();

    this.core.removeListener("mousemove", this.handleMapMouseMove);
    this.core.removeListener("click", this.handleMapClick);
    this.core.removeListener("mouseenter", "node", this.handleNodeEnter);
    this.core.removeListener("click", "node", this.handleNodeClick);
    this.resetCursor?.();

    if (!isDrawing) return;
    const positions = geometryTools.getPositions(this.core.getSelectedFeatures()[0]?.geometry);
    if (positions.length > 1) {
      positions.length > 2 && !this.types.includes("LineString") && this.selectedToPolygon();
      this.core.updateData();
    } else {
      this.core.features = [
        ...this.core.features.slice(0, this.core.selected[0] - 1),
        ...this.core.features.slice(0, this.core.selected[0]),
      ];
      this.core.render(this.core.features);
    }
  }
}
