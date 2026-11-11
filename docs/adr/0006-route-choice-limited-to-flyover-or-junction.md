# Route choice is limited to "flyover or the junction beneath", from live travel times

A vehicle chooses its route once, when it enters. Where through traffic can take either a flyover or the junction beneath it, the choice uses the current measured travel time of each, as a probability (the faster route gets the larger share, never all of it). Everywhere else the route is the fastest path on empty roads. We chose this because fixed routes would send all through traffic over a flyover even when it is jammed, which is wrong exactly when a planner is assessing a flyover, while an all-or-nothing choice makes traffic swing between the two routes.

## Not modelled

- **Equilibrium routing** (repeating the run until no driver can do better): too many runs per result.
- **Induced demand** (a faster road attracting new trips): needs travel-behaviour data we do not have. The planner gets a control that scales all demand up or down instead.

Both are named in the results as not modelled.
