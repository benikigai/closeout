#include "hal.h"

static hal_unit_t g_unit;
static int g_time_ms;
static int g_cal = -1;

void hal_init(const hal_unit_t *unit) {
    g_unit = *unit;
    g_time_ms = 0;
    g_cal = -1;
}

int hal_time_ms(void) { return g_time_ms; }
void hal_delay_ms(int ms) { g_time_ms += ms; }
int hal_led_driver_ready(void) { return g_time_ms >= g_unit.driver_ready_ms; }

int hal_led_write_cal(int value) {
    if (!hal_led_driver_ready()) return 0; /* write dropped: driver still starting */
    g_cal = value;
    return 1;
}

int hal_led_read_cal(void) { return g_cal; }

double hal_dome_uniformity(void) {
    if (g_unit.dome_defect) return 0.22;   /* physical defect: always fails */
    if (g_cal >= 0) return 0.02;           /* calibrated: uniform dome */
    return 0.18;                           /* uncalibrated: visibly lopsided */
}
