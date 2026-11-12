/**
 * Route choice between a flyover and the junction beneath it (ADR 0006).
 *
 * Where a flow has a choice. A vehicle's route is the fastest path on empty
 * roads, except where that path comes to a diverge (a junction with no signal
 * where its road divides) from which more than one road leads on to the
 * vehicle's exit. There each way on, followed by the fastest path from it, is
 * a route the flow can take: the flyover, or the junction beneath. Traffic
 * whose exit can be reached one way only (turning traffic) has no choice.
 *
 * When the choice is made. Once, when the vehicle comes to enter the network
 * (it reaches the front of those of its flow waiting to enter); it keeps that
 * route while it waits for room, and it is
 * never changed afterwards.
 *
 * The measured travel time of a route, at a moment, is the larger of
 *  - the mean time taken by the vehicles of the flow that completed the route
 *    in the last minute, from being placed on the network to leaving it; if
 *    none did in that minute, the time taken by the last one that completed
 *    it; and before any vehicle has completed it, the route's time on empty
 *    roads at the speed limits, which knows nothing of signals; and
 *  - the time so far of the vehicle of the flow that has been on the route
 *    longest and has not completed it.
 * The second part makes a jam count before anyone has got through it: on a
 * blocked route nobody completes, so the first part alone would never change.
 * Measuring over a minute, not over a set number of vehicles, lets a route
 * that has cleared show it with the first vehicle through: few vehicles use
 * a route that was slow, so a count of them would take long to fill.
 *
 * The choice. Each route's weight is its measured travel time to the power
 * minus k, so equal times give equal shares and a route twice as slow gets
 * 2^k times less. On top of that every route always keeps a smallest share,
 * so the choice is never all-or-nothing, and a route that was slow goes on
 * being tried, which is the only way its measured time can come down again.
 * The vehicle draws its route from those shares with a random stream used for
 * nothing else.
 *
 * The power form is the textbook "Kirchhoff" split used for static route
 * shares; the constants are ours (assumptions.ts, ROUTE_CHOICE_ASSUMPTIONS).
 * Equilibrium routing and induced demand are not modelled.
 */
import { ROUTE_CHOICE_ASSUMPTIONS } from "./assumptions";
import type { RandomStream } from "./random";

/**
 * The routes a flow can take from `entry` to `exit`: one, or one for each way
 * on at a diverge. `fastest` gives the fastest path on empty roads between two
 * roads (undefined when there is none); `waysOn` gives the roads a road leads
 * to when it ends at a diverge, and undefined when it does not.
 */
export function routesWithChoice<R>(
  entry: R,
  exit: R,
  fastest: (from: R, to: R) => R[] | undefined,
  waysOn: (road: R) => R[] | undefined,
  most = 8,
): R[][] {
  const first = fastest(entry, exit);
  if (!first) return [];
  for (let i = 0; i < first.length - 1; i++) {
    const ways = waysOn(first[i]!)?.filter((road) => fastest(road, exit) !== undefined);
    if (!ways || ways.length < 2) continue;
    const before = first.slice(0, i + 1);
    const routes: R[][] = [];
    for (const way of ways) {
      for (const rest of routesWithChoice(way, exit, fastest, waysOn, most)) {
        // A route never goes over the same road twice.
        if (rest.some((road) => before.includes(road))) continue;
        if (routes.length < most) routes.push([...before, ...rest]);
      }
    }
    if (routes.length > 0) return routes;
  }
  return [first];
}

/** One vehicle's journey along a route it chose, from being placed on the network. */
export interface Trip {
  route: number;
  startedAtS: number;
  finished: boolean;
}

export interface RouteChoice {
  /** Draw a route for a vehicle the demand has just produced. Gives the route's index. */
  choose(nowS: number): number;
  /** The share each route would get of vehicles choosing now. */
  shares(nowS: number): number[];
  /** The measured travel time of each route now, in seconds. */
  measuredTimesS(nowS: number): number[];
  /** A vehicle that chose a route has been placed on the network. */
  start(route: number, nowS: number): Trip;
  /** It has left the network at the end of its route. */
  finish(trip: Trip, nowS: number): void;
}

/** `emptyRoadTimesS` has each route's travel time on empty roads; `random` is used for nothing but this flow's choices. */
export function createRouteChoice(emptyRoadTimesS: number[], random: RandomStream): RouteChoice {
  const measuredOverS = ROUTE_CHOICE_ASSUMPTIONS.measuredOverS.value;
  const power = ROUTE_CHOICE_ASSUMPTIONS.travelTimePower.value;
  const smallest = Math.min(ROUTE_CHOICE_ASSUMPTIONS.smallestShare.value, 1 / emptyRoadTimesS.length);
  const routes = emptyRoadTimesS.map((emptyRoadTimeS) => ({
    emptyRoadTimeS,
    /** The vehicles that completed the route in the last minute (always at least the last one), oldest first, and the sum of their times. */
    recent: [] as { finishedAtS: number; tookS: number }[],
    recentTotalS: 0,
    /** Trips in the order they started; finished ones are dropped from the front when next looked at. */
    underWay: [] as Trip[],
    firstUnderWay: 0,
  }));

  function measuredTimesS(nowS: number): number[] {
    return routes.map((route) => {
      while (route.recent.length > 1 && route.recent[0]!.finishedAtS < nowS - measuredOverS) {
        route.recentTotalS -= route.recent.shift()!.tookS;
      }
      const completedS = route.recent.length > 0 ? route.recentTotalS / route.recent.length : route.emptyRoadTimeS;
      while (route.firstUnderWay < route.underWay.length && route.underWay[route.firstUnderWay]!.finished) route.firstUnderWay++;
      if (route.firstUnderWay > 64 && route.firstUnderWay * 2 > route.underWay.length) {
        route.underWay.splice(0, route.firstUnderWay);
        route.firstUnderWay = 0;
      }
      const longest = route.underWay[route.firstUnderWay];
      return Math.max(completedS, longest ? nowS - longest.startedAtS : 0);
    });
  }

  function shares(nowS: number): number[] {
    const weights = measuredTimesS(nowS).map((timeS) => Math.pow(Math.max(timeS, 1e-3), -power));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return weights.map((weight) => smallest + (1 - smallest * weights.length) * (weight / total));
  }

  return {
    measuredTimesS,
    shares,
    choose(nowS) {
      const u = random.next();
      let upTo = 0;
      const each = shares(nowS);
      for (let i = 0; i < each.length - 1; i++) {
        upTo += each[i]!;
        if (u < upTo) return i;
      }
      return each.length - 1;
    },
    start(route, nowS) {
      const trip: Trip = { route, startedAtS: nowS, finished: false };
      routes[route]!.underWay.push(trip);
      return trip;
    },
    finish(trip, nowS) {
      trip.finished = true;
      const route = routes[trip.route]!;
      const tookS = nowS - trip.startedAtS;
      route.recent.push({ finishedAtS: nowS, tookS });
      route.recentTotalS += tookS;
    },
  };
}
