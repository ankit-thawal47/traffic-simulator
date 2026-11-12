# 21: Visual polish

**What to build:** The 3D view looks finished: vehicle shapes generated in code that are recognisable by vehicle class, shadows, lighting, road markings, flyover pillars, and a few buildings around Hebbal. Capped at 8 hours of work.

**Blocked by:** 18

**Status:** ready-for-agent

- [x] Each vehicle class has a recognisable shape generated in code, drawn to scale
- [x] Shadows, lighting and road markings are in place
- [x] The flyover has pillars and reads clearly as a raised structure
- [x] The performance measurement is repeated and still meets the target
- [x] Work stops at the 8 hour cap; anything unfinished is listed

## Done (ticket/21-visual-polish)

- Vehicles: two-wheeler with rider, car, auto-rickshaw (three wheels, canopy, Bengaluru green and yellow), bus; generated in code (`vehicle-shapes.ts`), stretched to each vehicle's engine size, one instanced batch per class; colour by class and by speed both work (livery parts take the speed colour).
- Roads: carriageway with kerbs; lane and edge lines only with lane discipline; junction surface is the ground the turns sweep (`road-drawing.ts`), which removes the large dark patch at Hebbal.
- Flyovers: round piers with crossheads, parapets, lit underside, shadow on the road beneath.
- Light: sky dome, sun with soft shadows (only within 1,100 m of the camera's target, and dropped for good by a view below 40 frames a second), textured ground with haze; buildings and trees along a corridor only (`surroundings.ts`).
- Camera: a network with a flyover (examples, Hebbal, built networks with a flyover block) now opens about 110 m from its junction instead of 185 m.
- Names: road picker, flyover, flow and signal-timing controls and queue rows use planner names (`road-names.ts`), generated for built networks and example compass roads.
- Performance: `docs/performance.md`, section "After visual polish": two views of about 3,000 vehicles at 16x, 120 frames a second (display cap) before and after; 320 -> 223 uncapped.

## Not done at the cap

- No real tree or building data: surroundings are placed in code and are not a survey of what stands at Hebbal.
- Measured on one machine (M3 Pro) only; the automatic shadow fallback was not seen to trigger, and no slower machine was measured.
- Signal lamps are still plain cubes on posts; no pedestrian crossings.

