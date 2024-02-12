import { Map } from "mapbox-gl";
import { Geomeditor, MapboxSource } from "./src/main";

const container = document.getElementById("map");
if (container) {
  const { center, zoom } = JSON.parse(localStorage.getItem("geomeditor-params") ?? "{}");
  const map = new Map({
    accessToken: "pk.eyJ1IjoiZ3JhdmVyb2siLCJhIjoiY2xyd2o4azRlMHI3ODJpdGthc2N6dXN0biJ9.5yqGNBUQ7eh-iIbYGlCoyA",
    container,
    style: "mapbox://styles/mapbox/standard",
    zoom: zoom ?? 4,
    maxZoom: 18,
    optimizeForTerrain: true,
    center: center ?? [-20, 0],
  });

  map.on("move", () => {
    localStorage.setItem(
      "geomeditor-params",
      JSON.stringify({ center: map.getCenter().toArray(), zoom: map.getZoom() }),
    );
  });

  const editor = new Geomeditor(new MapboxSource(map));
  editor.setData(JSON.parse(localStorage.getItem("geomeditor-data") || "[]"));
  editor.setTool("edit");
  document.getElementById("pen")?.removeAttribute("disabled");
  document.getElementById("edit")?.removeAttribute("disabled");

  editor.onSelect((indices) => {
    if (indices.length) {
      document.getElementById("delete")?.removeAttribute("disabled");
    } else {
      document.getElementById("delete")?.setAttribute("disabled", "true");
    }
  });

  editor.onChange((data) => {
    editor.setTool("edit");
    editor.setData(data);
    localStorage.setItem("geomeditor-data", JSON.stringify(data));
  });

  document.getElementById("edit")?.addEventListener("click", () => {
    editor.setTool("edit");
  });

  document.getElementById("pen")?.addEventListener("click", () => {
    editor.setTool("pen");
  });

  document.getElementById("delete")?.addEventListener("click", () => {
    const selected = editor.selected;
    if (!selected.length) return;
    const currentData = JSON.parse(localStorage.getItem("geomeditor-data") || "[]");
    const data = currentData.filter((_: unknown, index: number) => !selected.includes(index));
    editor.setData(data);
    localStorage.setItem("geomeditor-data", JSON.stringify(data));
  });
}