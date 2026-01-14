"use strict";

const swiftParser = {
  parse: (text) => ({ text }),
  astFormat: "swift-ast",
  locStart: () => 0,
  locEnd: (node) => node.text.length,
};

const swiftPrinter = {
  print: (path) => path.getValue().text,
};

module.exports = {
  languages: [
    {
      name: "Swift",
      extensions: [".swift"],
      parsers: ["swift"],
    },
  ],
  parsers: {
    swift: swiftParser,
  },
  printers: {
    "swift-ast": swiftPrinter,
  },
};
