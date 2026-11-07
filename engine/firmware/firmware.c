#include "hal.h"

/* Beacon firmware v1 (buggy, as shipped to the fictional line).
   Calibration is written once at boot with no ready-wait and no readback.
   Cold second-source LED drivers are still starting at write time, so the
   write is dropped and the dome stays uncalibrated. Warm units pass.
   The corrective fix (wait-for-ready + readback) lands as a later patch. */
#define CAL_TARGET 42

int fw_calibrate(void) {
    hal_delay_ms(50); /* fixed boot-time write slot */
    return hal_led_write_cal(CAL_TARGET); /* 1 accepted, 0 dropped */
}

int fw_cal_applied(void) {
    return hal_led_read_cal() >= 0 ? 1 : 0;
}
