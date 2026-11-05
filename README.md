# Chess Review — Android PWA

A home-screen-installable companion app for reviewing **completed** Chess.com games. It imports `.pgn` / `.txt` files or pasted PGN text, shows the game move by move, and runs Stockfish 19 analysis in the browser.

## Features

- Import a PGN file or paste PGN text.
- Navigate every half-move and flip the board.
- Analyze the selected position and show the engine's best move, evaluation, and principal variation.
- Review the whole game and flag likely inaccuracies, mistakes, and blunders based on evaluation loss.
- No Chess.com login, account password, or connection to live matches.
- PGN content is processed in the browser; the app does not upload games to a server.

## Publish with GitHub Pages

1. Create a new **public** GitHub repository, for example `chess-review`.
2. Upload the contents of this ZIP so that `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `sw.js`, and `engine-loader.js` are in the repository's root (not inside an extra folder).
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose branch **main** and folder **/(root)**, then save.
6. Wait for GitHub Pages to publish and open the Pages URL it provides. It will look like `https://YOUR-ACCOUNT.github.io/chess-review/`.

## Install on Android

1. Open the published Pages URL in Chrome.
2. Open Chrome's three-dot menu and choose **Install app** or **Add to Home screen**.
3. Launch **Chess Review** from the new home-screen icon.
4. In Chess.com, open a completed game and use its Share / PGN export option, or download a PGN from your Game Archive.
5. In Chess Review, tap **Choose a PGN file** and select the downloaded file. You can also paste PGN text.
6. Select a position and tap **Analyze position**, or tap **Review whole game**.

## Engine download and internet

The engine is loaded the first time analysis is used. `engine-loader.js` loads the Stockfish 19 lite single-threaded WebAssembly build from jsDelivr. That build is about 1.7 MB and avoids the cross-origin isolation headers required by the multi-threaded build. After first load, the browser may cache its assets; the app shell is cached by the service worker. First launch and first engine load require an internet connection.

The app uses `chess.js` 1.4.0 from jsDelivr for PGN parsing and legal chess positions. Internet is required for the first module load as well.

## Accuracy notes

The whole-game review evaluates every position at the selected depth (capped at depth 13 for batch review on mobile). It estimates centipawn loss from consecutive position evaluations and classifies moves using practical thresholds: 0.75 pawns for an inaccuracy, 1.50 for a mistake, and 3.00 for a blunder. These are analysis heuristics, not official Chess.com classifications. Lower depth is faster; higher depth can be substantially slower on a phone.

## License notes

- Stockfish / Stockfish.js: GPL-3.0. The engine is loaded from its public npm CDN distribution rather than bundled in this repository.
- chess.js: BSD-2-Clause. Loaded as an ES module from jsDelivr.
- App UI and integration code in this repository: provided for modification and personal use.

## Scope

This is a post-game analysis companion. It does not read Chess.com screens, connect to a live game, or make moves in a live match.
