"""Run SUMO with one vehicle's speed forced at every step (benchmark T1.2).

Usage: python prescribed_speed.py <job.json>

The job file holds SUMO's command-line arguments, the id of the vehicle and
the speed it must have at each step time (index k is time k * step-length).
The vehicle's own model and safety checks are switched off (speed mode 0), so
it has exactly the prescribed speed; every other vehicle is left to SUMO.
"""
import json
import sys

import libsumo
import sumo

job = json.load(open(sys.argv[1]))
libsumo.start([sumo.SUMO_HOME + "/bin/sumo"] + job["args"])
vehicle = job["vehicleId"]
speeds = job["speedMps"]

# The first step inserts the vehicles (state at time 0); they move from the second step on.
libsumo.simulationStep()
libsumo.vehicle.setSpeedMode(vehicle, 0)
for k in range(1, len(speeds)):
    libsumo.vehicle.setSpeed(vehicle, speeds[k])
    libsumo.simulationStep()
libsumo.close()
