#include <stdio.h>
#include <stdlib.h>
#include "hal.h"

int fw_calibrate(void);
int fw_cal_applied(void);

/* One virtual unit per invocation. Parameters come from the runner seed.
   Usage: unit_sim <driver_ready_ms> <dome_defect 0|1>
   Prints one JSON object: cal_applied, uniformity, result for T-OPT-01. */
int main(int argc, char **argv) {
    if (argc != 3) { fprintf(stderr, "usage: unit_sim <ready_ms> <defect>\n"); return 2; }
    hal_unit_t unit = {0};
    unit.driver_ready_ms = atoi(argv[1]);
    unit.dome_defect = atoi(argv[2]);
    hal_init(&unit);
    fw_calibrate();
    double u = hal_dome_uniformity();
    printf("{\"cal_applied\": %d, \"uniformity\": %.2f, \"result\": \"%s\"}\n",
           fw_cal_applied(), u, u < 0.05 ? "pass" : "fail");
    return 0;
}
