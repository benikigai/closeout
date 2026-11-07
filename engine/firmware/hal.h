#pragma once
/* Fake hardware layer for the fictional beacon. All timing is virtual and
   deterministic: per-unit parameters come from the runner seed, never from
   wall-clock or threads. Same seed, same behavior, every run. */
typedef struct {
    int driver_ready_ms; /* LED driver ready delay for this unit (cold units are slow) */
    int nest_settle_ms;  /* touch nest settle time for this unit */
    int ambient_c;       /* unit temperature at test time */
    int dome_defect;     /* 1 = physical dome defect (known-bad); calibration cannot fix it */
} hal_unit_t;

void hal_init(const hal_unit_t *unit);
int  hal_time_ms(void);
void hal_delay_ms(int ms);
int  hal_led_driver_ready(void);       /* 1 once virtual time >= driver_ready_ms */
int  hal_led_write_cal(int value);     /* 1 if accepted, 0 if dropped (driver not ready) */
int  hal_led_read_cal(void);           /* last accepted calibration value, or -1 */
double hal_dome_uniformity(void);      /* measured dome non-uniformity; pass if < 0.05 */
