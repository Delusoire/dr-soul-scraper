import { configure, getConsoleSink } from "@logtape/logtape";

await configure({
   sinks: { console: getConsoleSink() },
   loggers: [
      { category: "dss", lowestLevel: "trace", sinks: ["console"] }
   ]
});
