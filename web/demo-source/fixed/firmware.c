#include "hal.h"
#define CAL_TARGET 42
int fw_calibrate(void) {
    while (!hal_led_driver_ready()) hal_delay_ms(10);
    if (hal_led_write_cal(CAL_TARGET)) return 1;
    hal_delay_ms(10);
    return hal_led_write_cal(CAL_TARGET);
}
int fw_cal_applied(void) { return hal_led_read_cal() >= 0 ? 1 : 0; }
