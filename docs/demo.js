const container = document.getElementById("map");

let editor;
const center = [29.895, 31.2];

const data = [
  ["M198.521 125.138V70.3055H211.994V113.623H239.176V125.138H198.521Z"],
  [
    "M249.315 69.5003V124.333L279.102 124.335L291.825 116.989L299.171 104.266V89.574L291.825 76.8506L279.102 69.5048L249.315 69.5003Z",
    "M273.587 81.0148L262.788 81.0152V112.818L273.587 112.815L280.966 108.554L285.227 101.175V92.6544L280.966 85.2752L273.587 81.0148Z",
  ],
  [
    "M143.443 124.333V69.5003L174.225 69.5048L180 71.6948L185.279 75.7185L189.5 82.2425V91.5671L187.5 95.1948L184.275 99.6425L179.241 102.322L190.756 124.333H175.716L165.819 104.3H156.917V124.333H143.443Z",
    "M156.92 80.6248L170.5 80.6248L173.858 82.4365L175.6 85.4531V88.9365L173.858 91.9531L170.5 93.6248H156.92L156.92 80.6248Z",
  ],
  [
    "M97.8634 68.3948L113.137 68.3948L126.363 76.0314L134 89.2583V104.531L126.363 117.758L113.137 125.395H97.8634L84.6366 117.758L77 104.531L77 89.2583L84.6366 76.0314L97.8634 68.3948Z",
    "M101.614 80.5919L109.386 80.5919L116.117 84.9468L120.003 92.4899V101.2L116.117 108.743L109.386 113.098H101.614L94.8833 108.743L90.9974 101.2L90.9974 92.4899L94.8833 84.9468L101.614 80.5919Z",
  ],
  [
    "M12.2199 124.333L0 69.5003H13.8649L20.5232 103.497L30.0798 69.5003H42.6914L52.248 103.497L58.9062 69.5003H72.3011L60.0812 124.333H45.8247L36.1897 89.0051L26.4765 124.333H12.2199Z",
  ],
  [
    "M247.769 0L263.042 7.85287e-07L276.269 7.63655L283.905 20.8634V36.1366L276.269 49.3635L263.042 57H247.769L234.542 49.3635L226.905 36.1366L226.905 20.8634L234.542 7.63655L247.769 0Z",
    "M251.519 12.197L259.291 12.197L266.022 16.552L269.908 24.095V32.805L266.022 40.348L259.291 44.703H251.519L244.789 40.348L240.903 32.805L240.903 24.095L244.789 16.552L251.519 12.197Z",
  ],
  ["M181.998 55.8894V1.05649H195.471V44.3745H222.652V55.8894H181.998Z"],
  ["M131.204 55.8894V1.05649H144.677V44.3745H171.859V55.8894H131.204Z"],
  ["M78.88 55.8894V1.05649H120.318V12.3364H92.3532V22.7547H112.093V33.7213H92.3532V44.6095H120.631V55.8894H78.88Z"],
  ["M18.3525 55.8894V1.05649H31.8257V22.363H53.9939V1.05649H67.4671V55.8894H53.9939V34.1912H31.8257V55.8894H18.3525Z"],
];

if (container) {
  const { Geoditor, MapboxController, MoveTool, PenTool, HandTool, DeleteTool } = geoditor;

  const map = new mapboxgl.Map({
    accessToken: "pk.eyJ1IjoiZ3JhdmVyb2siLCJhIjoiY2xyd2o4azRlMHI3ODJpdGthc2N6dXN0biJ9.5yqGNBUQ7eh-iIbYGlCoyA",
    container,
    style: "mapbox://styles/mapbox/standard",
    zoom: 11,
    maxZoom: 20,
    optimizeForTerrain: true,
    center: [29.895, 31.2],
  });

  const tools = {
    hand: new HandTool(),
    move: new MoveTool(),
    pen: new PenTool(),
    delete: new DeleteTool(),
  };

  editor = new Geoditor({
    controller: new MapboxController(map),
    tools,
  });

  editor.data = data.map((paths) => createPolygon(center, paths.map(makePath)));
  editor.tools.move();

  Object.keys(tools).forEach((key) => {
    const element = document.getElementById(key);
    if (!element) return;
    element.innerHTML = editor.icon(key, 1.2).toHTML();
    if (key !== "delete") element.removeAttribute("disabled");
    element.addEventListener("click", () => {
      editor.tools[key]();
    });
  });

  editor.on("tool", (tool) => {
    document.getElementById("controls")?.querySelector("[aria-current=true]")?.removeAttribute("aria-current");
    tool && document.getElementById(tool)?.setAttribute("aria-current", "true");
  });

  editor.on("change", () => {
    if (editor.tool === "pen") editor.tools.move();
  });

  editor.on("select", (selected) => {
    if (selected.length) {
      document.getElementById("delete")?.removeAttribute("disabled");
    } else {
      document.getElementById("delete")?.setAttribute("disabled", "true");
    }
  });

  const keyDown = (event) => {
    if (event.code === "Enter") {
      if (editor.tool !== "move") return;
      if (!editor.selected.length) return;
      if (editor.selected.some((n) => Array.isArray(n))) {
        editor.selected = editor.selected.map((n) => (Array.isArray(n) ? n[0] : n));
      } else {
        editor.selected = editor.selected.map((n) => (Array.isArray(n) ? n : [n]));
      }
      return;
    }
    if (event.code === "Backspace" || event.code === "Delete") return editor.tools.delete();
    if (event.code === "KeyH") return editor.tools.hand();
    if (event.code === "KeyV") return editor.tools.move();
    if (event.code === "KeyP") return editor.tools.pen();
    if (event.code === "Space") {
      const release = editor.tools.hand({ preserve: true });
      window.removeEventListener("keydown", keyDown);

      const end = (ev) => {
        if (ev.code === "Space") {
          release();
          window.removeEventListener("keyup", end);
          window.addEventListener("keydown", keyDown);
        }
      };

      window.addEventListener("keyup", end);
    }
  };

  window.addEventListener("keydown", keyDown);
}

function makePath(path) {
  const consts = ["M", "L", "H", "V", "Z"];
  let acc = "";
  let key = "M";
  const positions = [];

  for (let i = 0; i < path.length; i++) {
    if (consts.includes(path[i])) {
      if (acc) {
        switch (key) {
          case "L":
          case "M":
            const [x, y] = acc.split(" ");
            positions.push([+x, +y]);
            break;
          case "V":
            positions.push([positions[positions.length - 1][0], +acc]);
            break;
          case "H":
            positions.push([+acc, positions[positions.length - 1][1]]);
            break;
        }
      }
      acc = "";
      key = path[i];
    } else {
      acc += path[i];
    }
  }
  return positions;
}

function createPolygon(from, positions) {
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: positions.map((coordinates) => {
        return coordinates.map((pos) => {
          return [from[0] + (pos[0] - 150) / 2000, from[1] - (pos[1] - 65) / 2400];
        });
      }),
    },
  };
}
