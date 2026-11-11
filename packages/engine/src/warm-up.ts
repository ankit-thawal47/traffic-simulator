import { VEHICLE_CLASSES } from "./assumptions";
import type { QueueLength, Results, VehicleClassDelay } from "./types";

/**
 * A run's results with its warm-up left out: what happened between the end of
 * the warm-up and the moment of `atEnd`. Both arguments are what results()
 * gave, which counts from the start of the run.
 *
 * Counts (vehicles through, vehicles entered) are a difference. Time is the
 * length of the period. For each vehicle class:
 *  - the delay is the delay added after the warm-up, by every vehicle of the
 *    class: one produced during the warm-up counts only with the delay it
 *    gained afterwards;
 *  - the vehicles the mean is over are those that were there after the warm-up:
 *    every vehicle the demand has produced, less those that had already left
 *    the network when the warm-up ended;
 *  - the mean is the one divided by the other. It cannot be had from the two
 *    means alone, which is why results carry the total delay.
 */
export function resultsExcludingWarmUp(atEndOfWarmUp: Results, atEnd: Results): Results {
  const delayByVehicleClass = {} as Record<(typeof VEHICLE_CLASSES)[number], VehicleClassDelay>;
  for (const vehicleClass of VEHICLE_CLASSES) {
    const before = atEndOfWarmUp.delayByVehicleClass[vehicleClass];
    const after = atEnd.delayByVehicleClass[vehicleClass];
    const vehicles = after.vehicles - before.vehiclesThrough;
    const totalDelayS = after.totalDelayS - before.totalDelayS;
    delayByVehicleClass[vehicleClass] = {
      vehicles,
      vehiclesThrough: after.vehiclesThrough - before.vehiclesThrough,
      meanDelayS: vehicles > 0 ? totalDelayS / vehicles : null,
      totalDelayS,
    };
  }
  // The longest queue on each approach: the longest of the minutes after the
  // warm-up. A warm-up that ends part-way through a minute leaves that whole minute in.
  const firstMinute = Math.floor(atEndOfWarmUp.timeS / 60 + 1e-6);
  const longestQueueByApproach: Results["longestQueueByApproach"] = {};
  for (const [roadId, queue] of Object.entries(atEnd.longestQueueByApproach)) {
    const eachMinute = queue.eachMinute.slice(firstMinute).map((minute) => ({ ...minute }));
    let longest: QueueLength = { lengthM: 0, vehicles: 0 };
    for (const minute of eachMinute) if (minute.lengthM > longest.lengthM) longest = minute;
    longestQueueByApproach[roadId] = { lengthM: longest.lengthM, vehicles: longest.vehicles, eachMinute };
  }
  return {
    longestQueueByApproach,
    timeS: atEnd.timeS - atEndOfWarmUp.timeS,
    vehiclesEntered: atEnd.vehiclesEntered - atEndOfWarmUp.vehiclesEntered,
    vehiclesThrough: atEnd.vehiclesThrough - atEndOfWarmUp.vehiclesThrough,
    // How things stand at the end, not counts over a period: given as they are.
    vehiclesOnNetwork: atEnd.vehiclesOnNetwork,
    vehiclesWaitingToEnter: atEnd.vehiclesWaitingToEnter,
    delayByVehicleClass,
  };
}
