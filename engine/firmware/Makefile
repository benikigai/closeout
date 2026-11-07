CC ?= cc
CFLAGS ?= -O2 -Wall -Wextra -std=c11

unit_sim: firmware.o hal.o main.o
	$(CC) $(CFLAGS) -o $@ firmware.o hal.o main.o

%.o: %.c hal.h
	$(CC) $(CFLAGS) -c $< -o $@

test: unit_sim
	python3 test_firmware.py

clean:
	rm -f unit_sim *.o
