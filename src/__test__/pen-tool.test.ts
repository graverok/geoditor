import { check, mapModifiers, seac, seaC, seAc, sEac, sEaC, sEAc, Seac, SeaC, SeAc, SEac, SEaC } from "./pen-tool.mock";
import { PenToolConfig } from "../tools";

describe("defineModes: L+P+mL+mP", () => {
  const config: PenToolConfig = {
    drawTypes: ["Polygon", "LineString", "MultiLineString", "MultiPolygon"],
    create: true,
    append: true,
    subtract: true,
  };

  test("all", () => {
    mapModifiers(config, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "mL", "L+mL"], sEaC);
      check(mapped, ["P", "mP", "P+mP"], SeaC);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], SEaC);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], SeAc);
    });
  });

  test("create: false", () => {
    mapModifiers({ ...config, create: false }, (mapped) => {
      check(mapped, ["_"], seac);
      check(mapped, ["L", "mL"], sEAc);
      check(mapped, ["L+mL"], sEac);
      check(mapped, ["P", "mP"], SeAc);
      check(mapped, ["P+mP"], Seac);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], SEac);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], SeAc);
    });
  });

  test("append: false", () => {
    mapModifiers({ ...config, append: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL"], seaC);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP"], SeaC);
      check(mapped, ["[L]", "[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], Seac);
    });
  });

  test("subtract: false", () => {
    mapModifiers({ ...config, subtract: false }, (mapped) => {
      check(mapped, ["_", "P", "mP", "P+mP"], seaC);
      check(mapped, ["L", "mL", "L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEaC);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], seAc);
    });
  });

  test("create only", () => {
    mapModifiers({ ...config, append: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seaC,
      );
    });
  });

  test("append only", () => {
    mapModifiers({ ...config, subtract: false, create: false }, (mapped) => {
      check(mapped, ["_", "P+mP"], seac);
      check(mapped, ["L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEac);
      check(mapped, ["L", "mL"], sEAc);
      check(mapped, ["P", "mP"], seAc);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], seAc);
    });
  });

  test("subtract only", () => {
    mapModifiers({ ...config, append: false, create: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL", "[L]", "[mL]"], seac);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[P]", "[mP]"], Seac);
    });
  });

  test("none", () => {
    mapModifiers(
      {
        ...config,
        create: false,
        append: false,
        subtract: false,
      },
      (mapped) => {
        check(
          mapped,
          ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
          seac,
        );
      },
    );
  });
});
describe("defineModes: L+P+mL", () => {
  const config: PenToolConfig = {
    drawTypes: ["Polygon", "LineString", "MultiLineString"],
    create: true,
    append: true,
    subtract: true,
  };

  test("all", () => {
    mapModifiers(config, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "mL", "L+mL"], sEaC);
      check(mapped, ["P", "mP", "P+mP"], SeaC);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], SEaC);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], Seac);
    });
  });

  test("create: false", () => {
    mapModifiers({ ...config, create: false }, (mapped) => {
      check(mapped, ["_"], seac);
      check(mapped, ["L", "mL"], sEAc);
      check(mapped, ["L+mL"], sEac);
      check(mapped, ["P", "mP", "P+mP"], Seac);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], SEac);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], Seac);
    });
  });

  test("append: false", () => {
    mapModifiers({ ...config, append: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL"], seaC);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP"], SeaC);
      check(mapped, ["[L]", "[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], Seac);
    });
  });

  test("subtract: false", () => {
    mapModifiers({ ...config, subtract: false }, (mapped) => {
      check(mapped, ["_", "P", "mP", "P+mP"], seaC);
      check(mapped, ["L", "mL", "L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEaC);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("create only", () => {
    mapModifiers({ ...config, append: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seaC,
      );
    });
  });

  test("append only", () => {
    mapModifiers({ ...config, create: false, subtract: false }, (mapped) => {
      check(mapped, ["_", "P+mP"], seac);
      check(mapped, ["L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEac);
      check(mapped, ["L", "mL"], sEAc);
      check(mapped, ["P", "mP"], seac);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("subtract only", () => {
    mapModifiers({ ...config, create: false, append: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL", "[L]", "[mL]"], seac);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[P]", "[mP]"], Seac);
    });
  });

  test("none", () => {
    mapModifiers({ ...config, append: false, create: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seac,
      );
    });
  });
});
describe("defineModes: L+P+mP", () => {
  const config: PenToolConfig = {
    drawTypes: ["Polygon", "LineString", "MultiPolygon"],
    create: true,
    append: true,
    subtract: true,
  };

  test("all", () => {
    mapModifiers(config, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "mL", "L+mL"], sEaC);
      check(mapped, ["P", "mP", "P+mP"], SeaC);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], SEaC);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], SeAc);
    });
  });

  test("create: false", () => {
    mapModifiers({ ...config, create: false }, (mapped) => {
      check(mapped, ["_"], seac);
      check(mapped, ["L", "mL", "L+mL"], sEac);
      check(mapped, ["P", "mP"], SeAc);
      check(mapped, ["P+mP"], Seac);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], SEac);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], SeAc);
    });
  });

  test("append: false", () => {
    mapModifiers({ ...config, append: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL"], seaC);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP"], SeaC);
      check(mapped, ["[L]", "[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], Seac);
    });
  });

  test("subtract: false", () => {
    mapModifiers({ ...config, subtract: false }, (mapped) => {
      check(mapped, ["_", "P", "mP", "P+mP"], seaC);
      check(mapped, ["L", "mL", "L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEaC);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], seAc);
    });
  });

  test("create only", () => {
    mapModifiers({ ...config, append: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seaC,
      );
    });
  });

  test("append only", () => {
    mapModifiers({ ...config, create: false, subtract: false }, (mapped) => {
      check(mapped, ["_", "P+mP"], seac);
      check(mapped, ["L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEac);
      check(mapped, ["L", "mL"], sEac);
      check(mapped, ["P", "mP"], seAc);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], seAc);
    });
  });

  test("subtract only", () => {
    mapModifiers({ ...config, create: false, append: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL", "[L]", "[mL]"], seac);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[P]", "[mP]"], Seac);
    });
  });

  test("none", () => {
    mapModifiers({ ...config, append: false, create: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seac,
      );
    });
  });
});
describe("defineModes: L+mP", () => {
  const config: PenToolConfig = {
    drawTypes: ["LineString", "MultiPolygon"],
    create: true,
    append: true,
    subtract: true,
  };

  test("all", () => {
    mapModifiers(config, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "mL", "L+mL"], sEaC);
      check(mapped, ["P", "mP", "P+mP"], SeaC);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], SEaC);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], SeAc);
    });
  });

  test("create: false", () => {
    mapModifiers({ ...config, create: false }, (mapped) => {
      check(mapped, ["_"], seac);
      check(mapped, ["L", "mL", "L+mL"], sEac);
      check(mapped, ["P", "mP"], SeAc);
      check(mapped, ["P+mP"], Seac);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], SEac);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], SeAc);
    });
  });

  test("append: false", () => {
    mapModifiers({ ...config, append: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL"], seaC);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP"], SeaC);
      check(mapped, ["[L]", "[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], Seac);
    });
  });

  test("subtract: false", () => {
    mapModifiers({ ...config, subtract: false }, (mapped) => {
      check(mapped, ["_", "P", "mP", "P+mP"], seaC);
      check(mapped, ["L", "mL", "L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEaC);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], seAc);
    });
  });

  test("create only", () => {
    mapModifiers({ ...config, append: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seaC,
      );
    });
  });

  test("append only", () => {
    mapModifiers({ ...config, create: false, subtract: false }, (mapped) => {
      check(mapped, ["_", "P+mP"], seac);
      check(mapped, ["L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEac);
      check(mapped, ["L", "mL"], sEac);
      check(mapped, ["P", "mP"], seAc);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], seAc);
    });
  });

  test("subtract only", () => {
    mapModifiers({ ...config, create: false, append: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL", "[L]", "[mL]"], seac);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[P]", "[mP]"], Seac);
    });
  });

  test("none", () => {
    mapModifiers({ ...config, append: false, create: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seac,
      );
    });
  });
});
describe("defineModes: L+P", () => {
  const config: PenToolConfig = {
    drawTypes: ["Polygon", "LineString"],
    create: true,
    append: true,
    subtract: true,
  };

  test("all", () => {
    mapModifiers(config, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "mL", "L+mL"], sEaC);
      check(mapped, ["P", "mP", "P+mP"], SeaC);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], SEaC);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], Seac);
    });
  });

  test("create: false", () => {
    mapModifiers({ ...config, create: false }, (mapped) => {
      check(mapped, ["_"], seac);
      check(mapped, ["L", "mL", "L+mL"], sEac);
      check(mapped, ["P", "mP", "P+mP"], Seac);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], SEac);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], Seac);
    });
  });

  test("append: false", () => {
    mapModifiers({ ...config, append: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL"], seaC);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP"], SeaC);
      check(mapped, ["[L]", "[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], Seac);
    });
  });

  test("subtract: false", () => {
    mapModifiers({ ...config, subtract: false }, (mapped) => {
      check(mapped, ["_", "P", "mP", "P+mP"], seaC);
      check(mapped, ["L", "mL", "L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEaC);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("create only", () => {
    mapModifiers({ ...config, append: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seaC,
      );
    });
  });

  test("append only", () => {
    mapModifiers({ ...config, create: false, subtract: false }, (mapped) => {
      check(mapped, ["_", "P+mP"], seac);
      check(mapped, ["L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEac);
      check(mapped, ["L", "mL"], sEac);
      check(mapped, ["P", "mP"], seac);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("subtract only", () => {
    mapModifiers({ ...config, create: false, append: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL", "[L]", "[mL]"], seac);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[P]", "[mP]"], Seac);
    });
  });

  test("none", () => {
    mapModifiers({ ...config, append: false, create: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seac,
      );
    });
  });
});
describe("defineModes: L+mL", () => {
  const config: PenToolConfig = {
    drawTypes: ["LineString", "MultiLineString"],
    create: true,
    append: true,
    subtract: true,
  };

  test("all", () => {
    mapModifiers(config, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "mL", "L+mL"], sEaC);
      check(mapped, ["P", "mP", "P+mP"], seaC);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], sEaC);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("create: false", () => {
    mapModifiers({ ...config, create: false }, (mapped) => {
      check(mapped, ["_"], seac);
      check(mapped, ["L", "mL"], sEAc);
      check(mapped, ["L+mL"], sEac);
      check(mapped, ["P", "mP", "P+mP"], seac);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], sEac);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("append: false", () => {
    mapModifiers({ ...config, append: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL"], seaC);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP"], seaC);
      check(mapped, ["[L]", "[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("subtract: false", () => {
    mapModifiers({ ...config, subtract: false }, (mapped) => {
      check(mapped, ["_", "P", "mP", "P+mP"], seaC);
      check(mapped, ["L", "mL", "L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEaC);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("create only", () => {
    mapModifiers({ ...config, subtract: false, append: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seaC,
      );
    });
  });

  test("append only", () => {
    mapModifiers({ ...config, subtract: false, create: false }, (mapped) => {
      check(mapped, ["_", "P+mP"], seac);
      check(mapped, ["L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEac);
      check(mapped, ["L", "mL"], sEAc);
      check(mapped, ["P", "mP"], seac);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("subtract only", () => {
    mapModifiers({ ...config, append: false, create: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL", "[L]", "[mL]"], seac);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[P]", "[mP]"], seac);
    });
  });

  test("none", () => {
    mapModifiers({ ...config, create: false, append: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seac,
      );
    });
  });
});
describe("defineModes: mL", () => {
  const config: PenToolConfig = {
    drawTypes: ["MultiLineString"],
    create: true,
    append: true,
    subtract: true,
  };

  test("all", () => {
    mapModifiers(config, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "mL", "L+mL"], sEaC);
      check(mapped, ["P", "mP", "P+mP"], seaC);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], sEaC);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("create: false", () => {
    mapModifiers({ ...config, create: false }, (mapped) => {
      check(mapped, ["_"], seac);
      check(mapped, ["L", "mL"], sEAc);
      check(mapped, ["L+mL"], sEac);
      check(mapped, ["P", "mP", "P+mP"], seac);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], sEac);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("append: false", () => {
    mapModifiers({ ...config, append: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL"], seaC);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP"], seaC);
      check(mapped, ["[L]", "[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("subtract: false", () => {
    mapModifiers({ ...config, subtract: false }, (mapped) => {
      check(mapped, ["_", "P", "mP", "P+mP"], seaC);
      check(mapped, ["L", "mL", "L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEaC);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("create only", () => {
    mapModifiers({ ...config, subtract: false, append: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seaC,
      );
    });
  });

  test("append only", () => {
    mapModifiers({ ...config, subtract: false, create: false }, (mapped) => {
      check(mapped, ["_", "P+mP"], seac);
      check(mapped, ["L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEac);
      check(mapped, ["L", "mL"], sEAc);
      check(mapped, ["P", "mP"], seac);
      check(mapped, ["[L]", "[mL]"], sEAc);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("subtract only", () => {
    mapModifiers({ ...config, append: false, create: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL", "[L]", "[mL]"], seac);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[P]", "[mP]"], seac);
    });
  });

  test("none", () => {
    mapModifiers({ ...config, create: false, append: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seac,
      );
    });
  });
});
describe("defineModes: L", () => {
  const config: PenToolConfig = {
    drawTypes: ["LineString"],
    create: true,
    append: true,
    subtract: true,
  };

  test("all", () => {
    mapModifiers(config, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "mL", "L+mL"], sEaC);
      check(mapped, ["P", "mP", "P+mP"], seaC);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], sEaC);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("create: false", () => {
    mapModifiers({ ...config, create: false }, (mapped) => {
      check(mapped, ["_"], seac);
      check(mapped, ["L", "mL", "L+mL"], sEac);
      check(mapped, ["P", "mP", "P+mP"], seac);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], sEac);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("append: false", () => {
    mapModifiers({ ...config, append: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL"], seaC);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP"], seaC);
      check(mapped, ["[L]", "[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("subtract: false", () => {
    mapModifiers({ ...config, subtract: false }, (mapped) => {
      check(mapped, ["_", "P", "mP", "P+mP"], seaC);
      check(mapped, ["L", "mL", "L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEaC);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("create only", () => {
    mapModifiers({ ...config, subtract: false, append: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seaC,
      );
    });
  });

  test("append only", () => {
    mapModifiers({ ...config, subtract: false, create: false }, (mapped) => {
      check(mapped, ["_", "P+mP"], seac);
      check(mapped, ["L+mL", "L+P", "L+mP", "P+mL", "mL+mP"], sEac);
      check(mapped, ["L", "mL"], sEac);
      check(mapped, ["P", "mP"], seac);
      check(mapped, ["[L]", "[mL]"], sEac);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("subtract only", () => {
    mapModifiers({ ...config, append: false, create: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL", "[L]", "[mL]"], seac);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[P]", "[mP]"], seac);
    });
  });

  test("none", () => {
    mapModifiers({ ...config, create: false, append: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seac,
      );
    });
  });
});

describe("defineModes: P+mP", () => {
  const config: PenToolConfig = {
    drawTypes: ["Polygon", "MultiPolygon"],
    create: true,
    append: true,
    subtract: true,
  };

  test("all", () => {
    mapModifiers(config, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "L+mL"], sEaC);
      check(mapped, ["mL"], seaC);
      check(mapped, ["P", "mP"], SeaC);
      check(mapped, ["P+mP"], SeaC);
      check(mapped, ["L+P", "L+mP"], SEaC);
      check(mapped, ["P+mL", "mL+mP"], SeaC);
      check(mapped, ["[L]"], sEac);
      check(mapped, ["[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], SeAc);
    });
  });

  test("create: false", () => {
    mapModifiers({ ...config, create: false }, (mapped) => {
      check(mapped, ["_"], seac);
      check(mapped, ["L", "L+mL"], sEac);
      check(mapped, ["mL"], seac);
      check(mapped, ["P", "mP"], SeAc);
      check(mapped, ["P+mP"], Seac);
      check(mapped, ["L+P", "L+mP"], SEac);
      check(mapped, ["P+mL", "mL+mP"], Seac);
      check(mapped, ["[L]"], sEac);
      check(mapped, ["[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], SeAc);
    });
  });

  test("append: false", () => {
    mapModifiers({ ...config, append: false }, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "L+mL", "mL"], seaC);
      check(mapped, ["P", "mP", "P+mP"], SeaC);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], SeaC);
      check(mapped, ["[L]", "[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], Seac);
    });
  });

  test("subtract: false", () => {
    mapModifiers({ ...config, subtract: false }, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "L+mL"], sEaC);
      check(mapped, ["mL"], seaC);
      check(mapped, ["P", "mP", "P+mP"], seaC);
      check(mapped, ["L+P", "L+mP"], sEaC);
      check(mapped, ["P+mL", "mL+mP"], seaC);
      check(mapped, ["[L]"], sEac);
      check(mapped, ["[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], seAc);
    });
  });

  test("create only", () => {
    mapModifiers({ ...config, subtract: false, append: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seaC,
      );
    });
  });

  test("append only", () => {
    mapModifiers({ ...config, subtract: false, create: false }, (mapped) => {
      check(mapped, ["_", "P+mP"], seac);
      check(mapped, ["L+mL", "L+P", "L+mP"], sEac);
      check(mapped, ["P+mL", "mL+mP"], seac);
      check(mapped, ["L"], sEac);
      check(mapped, ["mL"], seac);
      check(mapped, ["P", "mP"], seAc);
      check(mapped, ["[L]"], sEac);
      check(mapped, ["[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], seAc);
    });
  });

  test("subtract only", () => {
    mapModifiers({ ...config, append: false, create: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL", "[L]", "[mL]"], seac);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[P]", "[mP]"], Seac);
    });
  });

  test("none", () => {
    mapModifiers({ ...config, create: false, append: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seac,
      );
    });
  });
});
describe("defineModes: mP", () => {
  const config: PenToolConfig = {
    drawTypes: ["MultiPolygon"],
    create: true,
    append: true,
    subtract: true,
  };

  test("all", () => {
    mapModifiers(config, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "L+mL"], sEaC);
      check(mapped, ["mL"], seaC);
      check(mapped, ["P", "mP"], SeaC);
      check(mapped, ["P+mP"], SeaC);
      check(mapped, ["L+P", "L+mP"], SEaC);
      check(mapped, ["P+mL", "mL+mP"], SeaC);
      check(mapped, ["[L]"], sEac);
      check(mapped, ["[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], SeAc);
    });
  });

  test("create: false", () => {
    mapModifiers({ ...config, create: false }, (mapped) => {
      check(mapped, ["_"], seac);
      check(mapped, ["L", "L+mL"], sEac);
      check(mapped, ["mL"], seac);
      check(mapped, ["P", "mP"], SeAc);
      check(mapped, ["P+mP"], Seac);
      check(mapped, ["L+P", "L+mP"], SEac);
      check(mapped, ["P+mL", "mL+mP"], Seac);
      check(mapped, ["[L]"], sEac);
      check(mapped, ["[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], SeAc);
    });
  });

  test("append: false", () => {
    mapModifiers({ ...config, append: false }, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "L+mL", "mL"], seaC);
      check(mapped, ["P", "mP", "P+mP"], SeaC);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], SeaC);
      check(mapped, ["[L]", "[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], Seac);
    });
  });

  test("subtract: false", () => {
    mapModifiers({ ...config, subtract: false }, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "L+mL"], sEaC);
      check(mapped, ["mL"], seaC);
      check(mapped, ["P", "mP", "P+mP"], seaC);
      check(mapped, ["L+P", "L+mP"], sEaC);
      check(mapped, ["P+mL", "mL+mP"], seaC);
      check(mapped, ["[L]"], sEac);
      check(mapped, ["[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], seAc);
    });
  });

  test("create only", () => {
    mapModifiers({ ...config, subtract: false, append: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seaC,
      );
    });
  });

  test("append only", () => {
    mapModifiers({ ...config, subtract: false, create: false }, (mapped) => {
      check(mapped, ["_", "P+mP"], seac);
      check(mapped, ["L+mL", "L+P", "L+mP"], sEac);
      check(mapped, ["P+mL", "mL+mP"], seac);
      check(mapped, ["L"], sEac);
      check(mapped, ["mL"], seac);
      check(mapped, ["P", "mP"], seAc);
      check(mapped, ["[L]"], sEac);
      check(mapped, ["[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], seAc);
    });
  });

  test("subtract only", () => {
    mapModifiers({ ...config, append: false, create: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL", "[L]", "[mL]"], seac);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[P]", "[mP]"], Seac);
    });
  });

  test("none", () => {
    mapModifiers({ ...config, create: false, append: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seac,
      );
    });
  });
});
describe("defineModes: P", () => {
  const config: PenToolConfig = {
    drawTypes: ["Polygon"],
    create: true,
    append: true,
    subtract: true,
  };

  test("all", () => {
    mapModifiers(config, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "L+mL"], sEaC);
      check(mapped, ["mL"], seaC);
      check(mapped, ["P", "mP", "P+mP"], SeaC);
      check(mapped, ["L+P", "L+mP"], SEaC);
      check(mapped, ["P+mL", "mL+mP"], SeaC);
      check(mapped, ["[L]"], sEac);
      check(mapped, ["[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], Seac);
    });
  });

  test("create: false", () => {
    mapModifiers({ ...config, create: false }, (mapped) => {
      check(mapped, ["_"], seac);
      check(mapped, ["L", "L+mL"], sEac);
      check(mapped, ["mL"], seac);
      check(mapped, ["P", "mP", "P+mP"], Seac);
      check(mapped, ["L+P", "L+mP"], SEac);
      check(mapped, ["P+mL", "mL+mP"], Seac);
      check(mapped, ["[L]"], sEac);
      check(mapped, ["[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], Seac);
    });
  });

  test("append: false", () => {
    mapModifiers({ ...config, append: false }, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "L+mL", "mL"], seaC);
      check(mapped, ["P", "mP", "P+mP"], SeaC);
      check(mapped, ["L+P", "L+mP", "P+mL", "mL+mP"], SeaC);
      check(mapped, ["[L]", "[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], Seac);
    });
  });

  test("subtract: false", () => {
    mapModifiers({ ...config, subtract: false }, (mapped) => {
      check(mapped, ["_"], seaC);
      check(mapped, ["L", "L+mL"], sEaC);
      check(mapped, ["mL"], seaC);
      check(mapped, ["P", "mP", "P+mP"], seaC);
      check(mapped, ["L+P", "L+mP"], sEaC);
      check(mapped, ["P+mL", "mL+mP"], seaC);
      check(mapped, ["[L]"], sEac);
      check(mapped, ["[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("create only", () => {
    mapModifiers({ ...config, subtract: false, append: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seaC,
      );
    });
  });

  test("append only", () => {
    mapModifiers({ ...config, subtract: false, create: false }, (mapped) => {
      check(mapped, ["_", "P+mP"], seac);
      check(mapped, ["L+mL", "L+P", "L+mP"], sEac);
      check(mapped, ["P+mL", "mL+mP"], seac);
      check(mapped, ["L"], sEac);
      check(mapped, ["mL"], seac);
      check(mapped, ["P", "mP"], seac);
      check(mapped, ["[L]"], sEac);
      check(mapped, ["[mL]"], seac);
      check(mapped, ["[P]", "[mP]"], seac);
    });
  });

  test("subtract only", () => {
    mapModifiers({ ...config, append: false, create: false }, (mapped) => {
      check(mapped, ["_", "L", "mL", "L+mL", "[L]", "[mL]"], seac);
      check(mapped, ["P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[P]", "[mP]"], Seac);
    });
  });

  test("none", () => {
    mapModifiers({ ...config, create: false, append: false, subtract: false }, (mapped) => {
      check(
        mapped,
        ["_", "L", "mL", "L+mL", "P", "mP", "P+mP", "L+P", "L+mP", "P+mL", "mL+mP", "[L]", "[mL]", "[P]", "[mP]"],
        seac,
      );
    });
  });
});
