# Static site with no backend in v1

The product ships as a static site: no server, no accounts, no database. A scenario is saved as a link or a JSON file, behind a storage module that can be swapped. We chose this because the build has a 72-hour limit, free server hosting has narrowed (sleeping instances, paid tiers), and a server is one more thing that can fail while the work is being reviewed. A backend with accounts, a saved-scenario library and run history is v3, outside the 72 hours.

## Consequences

- A planner cannot browse saved scenarios across devices in v1; sharing is by link or file.
- The scenario format must be versioned from day one, because old links and files have to keep loading.
- Storage goes through one module from the start, so v3 can add a backend without touching the rest.
