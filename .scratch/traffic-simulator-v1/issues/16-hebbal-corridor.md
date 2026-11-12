# 16: Hebbal corridor

**What to build:** A planner opens the Hebbal corridor, city-bound, ready to run: the flyover, the signal junction beneath it, and the next junction downstream, with lanes and widths checked by hand and the published signal plan.

**Blocked by:** 07

**Status:** in progress (data, sources and ground-level importer merged; raised roads, merges, full run and attribution remain)

- [ ] An importer written in TypeScript turns OpenStreetMap data plus a corrections file into a network
- [ ] The corridor includes the flyover, the junction beneath and the next junction downstream
- [ ] Lanes, widths and levels for every road in the corridor have been checked by hand and recorded in the corrections file with their source
- [ ] The signal junction uses the published signal plan, confirmed from its source
- [ ] Default demand and vehicle mix are set, with their sources or marked as assumed
- [ ] The corridor runs for a full hour with consistency checks passing
- [ ] OpenStreetMap attribution and licence obligations are met for the shipped network
