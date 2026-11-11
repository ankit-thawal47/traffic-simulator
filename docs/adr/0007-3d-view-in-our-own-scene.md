# The view is 3D, in one three.js scene of our own, with no map library

Traffic is shown in 3D: one three.js scene used for both the Hebbal corridor and builder networks, with the flyover as real raised geometry, vehicles as low-detail shapes generated in code, a free orbiting camera and a straight-down preset. The comparison shows baseline and proposal as two views sharing one camera. We chose 3D because how the product looks matters a great deal to its owner, and a flyover reads far better as a raised structure.

## Considered options

- **2D top-down.** Cheaper by about a day and shows gaps between vehicles most clearly. Rejected on visual impact; the straight-down camera preset keeps its clarity.
- **3D on top of a real map** (map library plus a 3D layer). Rejected: two renderers to keep in step, and builder networks are not real places.
- **Downloaded vehicle models.** Rejected: each needs a licence check, and detailed models are slow at thousands of vehicles.

## Consequences

- No map tiles and no outside tile service; Hebbal's surroundings are whatever we draw.
- The thin slice renders in 3D with plain boxes from the first day. Polish (vehicle shapes, shadows, lighting, road markings, pillars, a few Hebbal buildings) starts only after benchmark tiers 0 and 1 pass, and is capped at 8 hours.
- Two 3D views double the drawing work; this is part of the performance measurement in the thin slice.
