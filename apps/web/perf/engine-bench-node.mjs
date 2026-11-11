// Child process for one engine measurement: node engine-bench-node.mjs <bundle.js> <options as JSON>
import { pathToFileURL } from "node:url";

const [bundle, options] = process.argv.slice(2);
const { measureEngine } = await import(pathToFileURL(bundle).href);
console.log(JSON.stringify(measureEngine(JSON.parse(options))));
