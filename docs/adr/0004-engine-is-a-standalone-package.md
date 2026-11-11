# The engine is a standalone TypeScript package with no browser dependencies

The engine lives in its own package and may not touch the page, the map, the network or the clock. The app runs it in a background worker; the tests and the SUMO comparison run the same code from the command line. We chose this so that one implementation serves the product, the automated checks and the benchmark, and so that a slow run cannot freeze the page.

## Consequences

- Everything the engine needs (network, scenario, seed) is passed in; everything it produces (positions, metrics) is passed out as plain data.
- The app, built with React, Vite and three.js, depends on the engine; the engine never depends on the app.
