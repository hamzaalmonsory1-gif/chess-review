// Same-origin worker wrapper; the Stockfish WebAssembly files are served by jsDelivr.
// The lite single-threaded build works without SharedArrayBuffer isolation headers.
const STOCKFISH_BASE = 'https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/';
self.Module = {
  locateFile(path) {
    return path.endsWith('.wasm') ? STOCKFISH_BASE + path : path;
  }
};
importScripts(STOCKFISH_BASE + 'stockfish-19-lite-single.js');
