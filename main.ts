import { configure, getConsoleSink } from "@logtape/logtape";

await configure( {
   sinks: { console: getConsoleSink() },
   loggers: [
      { category: "dss", lowestLevel: "trace", sinks: [ "console" ] }
   ]
} );

await Deno.cron( "periodic scraper", {
   hour: { every: 2 },
}, () => {

} );
