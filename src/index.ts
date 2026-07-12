/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Default system prompt
const SYSTEM_PROMPT = `
You are an expert Electronics Repair Assistant for M.V. Electronix LLC. 
You help technicians diagnose faults, identify components, and follow repair procedures.

### KNOWLEDGE BASE

#### 1. COMPONENT VALUES & REFERENCE
(Diode Checks, Resistors, Voltages)

- **1N5819 Schottky Diode:** Forward Voltage Drop is 0.15V - 0.45V. 
- **Standard Silicon Diode (1N4007):** Forward Voltage Drop is 0.5V - 0.7V.
- **MacBook Pro 2019:** 3V3_S5 Rail should be present before turning on.
- **Capacitor Polarity:** Check stripe (-) on board vs. cathode marking on component.

#### 2. COMMON FAULTS & SYMPTOMS
(Symptoms to Solutions)

- **iPhone 12 No Backlight:**
  - Short on PP_VBOOST_MAIN (6.8V).
  - Check Tantalum capacitor C8505.
  - If short is present, inject voltage to find culprit.

- **MacBook Pro A1708 No Power:**
  - Check PPBUS_G3H (12.6V).
  - If missing, check CD3215 (USB-C controllers) for liquid damage.
  - Check U7360 buck converter.

- **Xbox One 1540 Standby Light:**
  - No standby 5V? Check Southbridge pins.
  - If V_5P0STBY is present but console won't turn on, check 12V enable signal.

#### 3. DETAILED REPAIR GUIDES
(Step-by-step procedures)

- **Guide: Replacing SMC on Xbox One**
  1. Identify SMC (KIC) near Southbridge.
  2. Remove shield if present.
  3. Use Hot Air (350°C) to remove chip.
  4. Clean pads with flux.
  5. Reball new SMC.
  6. Align correctly (Pin 1 dot).
  7. Reflow.

- **Guide: Finding Short on PP3V3_S5 (MacBook)**
  1. Inject 2.5V into the line.
  2. Check current draw. 
  3. Locate the warmest component with thermal camera.
  4. Replace component.

  ### Nintendo Switch Board Troubleshooting

1. FIRST-STAGE BOOT – VSYS SHORT CHECKS
The first step is confirming the VSYS rail from the BQ24193 charger is not shorted.
A short on VSYS can kill the BQ or other components.

To test VSYS for shorts:
- Remove battery
- Disconnect all components from motherboard (bare board only)
- Solder ground wire to USB shield
- Solder positive wire to bottom of VSYS inductor

Injecting VSYS:
- Set bench power to 4.2V, 1A limit
- Ground = USB shield
- Positive = VSYS inductor
- Expected draw: 0.001A to 0.005A
- If draw exceeds 0.01A, there is a short
- Find short using thermal camera
- Common cause: dead BQ24193

2. FIRST-STAGE BOOT RAIL TESTING (MAX77620 AND 3.3V REGULATOR)
After VSYS passes, test the PMIC rails:
1.0V
1.1V
1.3V
1.8V
2.9V
3.3V (ENxx regulator)

Failures prevent second-stage boot.

Common failure points:
MAX77620
ENxx regulator
P13USB
M92T36
eMMC
MAX77621 or MAX77812

3. FIRST-STAGE BOOT TEST (TURNING ON WHILE VSYS IS INJECTED)
Steps:
- Keep 4.2V injected into VSYS
- Turn console on using power button ribbon or short pin 1 to pin 2

Expected readings:
- About 195mA = good
- About 135mA = failing MAX77621 or MAX77812
- Much higher than 200mA = short on CPU, RAM, P13USB, M92T36, audio IC

If abnormal:
- 0mA = MAX77620 likely dead
- Dead short = find with thermal camera
- Fix issues before continuing

4. DEAD SHORT TESTS (INJECT 1V INTO RAILS)
Inject 1V into each rail. Expected current pulls:

VDD_CPU_1V8: 100-500mA
VDD_1V3: 0mA
VDD_CPU_1V0: 90-135mA
VDD_CPU_1V1: 145mA
VDD_1V05A: 0mA
VDD_1V05B: 55mA
VDD_1V3: 15-90mA
VCC_2V9: 0mA
VCC_3V3: 40mA
VDD_1V0: 1mA

5. ERROR CODES
2101-0001: I2C communication issue. Most common cause: M92T36
2002-2000 to 2002-2499: microSD card or slot failure

6. 3.3V REGULATOR CHECKS
The ENxx IC outputs 3.3V. Output limit is about 150mA.

Symptoms of issues:
- Output below 0.5V may indicate a short

Testing 3.3V rail:
- Ground wire to USB shield
- Wire to 3.3V capacitor
- Inject 1V
- If draw >0.1A, short exists
- Locate with thermal camera or IPA

Components on 3.3V rail:
P13USB
M92T36
Bluetooth/WiFi module
Possibly eMMC and small regulators

7. FULL BOOT FROM BENCH POWER
Required working parts:
MAX77620
BQ24193
MAX77621 or MAX77812
RAM
CPU and eMMC

Bench boot setup:
- Remove battery
- Inject 4.2V into VBAT
- Add 10k resistor between battery test pads
- Limit current to 2A
- System can fully boot to Nintendo logo

8. MT92T36 TESTING AND SYMPTOMS
Testing:
- Meter in diode mode
- Red probe on ground
- Black probe on capacitors around M92T36
- Both sides beeping permanently = bad M92T36 or P13USB

Symptoms:
- Boots to Nintendo logo then shuts off
- Boot loop between 400-800mA and 200mA
- USB-C works only one way

Fix check:
Remove M92T36 and P13USB and try to boot.

9. FUEL GAUGE MAX17050 ISSUES
Symptoms:
- System stops at 100-150mA
- Random shutdown
- No charging

10. BQ24193 CHARGER TESTING
Key pins:
VBUS (5V or 15V input)
VBAT (battery)
SYS (output)

VSYS must be same or higher than battery voltage.

Capacitor testing:
- Use diode mode
- Only one side should beep
- Continuous beep on both = short
- Remove capacitor to confirm
- If PCB pads still short: BQ24193 is faulty

11. BATTERY TESTING
Battery should measure 2.8V to 4.2V.
0V = protection mode or dead cell.
Voltage drop >0.02V in 10 seconds indicates a short on the board.

12. USB CHARGER TEST
Using USB-C tester and official charger:

Expected:
- 15V negotiated ideally
- 0.1A to 0.5A charging current
Battery voltage should rise 0.1V or more.

13. BENCH CHARGING TEST
Procedure:
- Ground to USB shield
- Positive to VBUS capacitor
- Bench power set to 5V

Expected:
- Battery <3.0V: 40-100mA
- Battery >3.0V: around 470mA

14. BOOT CURRENT SIGNATURES
Fully working boot:
100mA then 150mA then 500-800mA, then sleep 8-340mA

Corrupt eMMC boot flags:
150mA -> 375mA -> stuck at 100mA

Dead short:
Excessive current, hot inductor

Bad backlight:
400-500mA but no display

Bad P13USB:
3.3V rail pulled low; fixed draw around 300mA

Bad fuel gauge:
100-150mA and stops

Bad MAX77621:
Instant 100mA

Current limited:
0 -> 200-300mA -> 0 -> loop

Bad M92T36:
Boots to 200mA
Jumps to 400-800mA
Drops back to 200mA or loops

Bad eMMC:
180-240mA and no second-stage boot

AutoRCM corrupt bits:
200-240mA and black screen

BEGIN FAULT CHART

General Notes
All readings done in diode mode.
Red probe on ground.
Black probe on tested point.

Values vary +/- 0.030V depending on meter.

M92T36 USB-PD Controller (Pin Numbers + Diode Mode)

Pin 1 CC1........................0.520V
Pin 2 CC2........................0.518V
Pin 3 VBUS_A.....................OL / 0.003V
Pin 4 VBUS_B.....................OL / 0.003V
Pin 5 SBU1.......................0.520V
Pin 6 SBU2.......................0.518V
Pin 7 5V Enable..................0.670V
Pin 8 3.3V Rail Input............0.560V
Pin 9 D+........................0.425V
Pin 10 D-........................0.430V

Fault Interpretation:
CC1 or CC2 = 0.000V → port ESD damage or dead M92T
CC1 or CC2 OL both ways → broken trace
VBUS_A/B = short both ways → shorted cap or port damage
5V enable <0.400V → M92T not switching
3.3V rail = 0V → P13USB or M92 shorting system
D+ / D- <0.250V → bad USB-C port or M92T internal short

P13USB HDMI/USB Mux IC (Pin Numbers + Diode Values)

Pin 1 HS_A+......................0.428V
Pin 2 HS_A-......................0.430V
Pin 3 HS_B+......................0.428V
Pin 4 HS_B-......................0.430V
Pin 5 3.3V.......................0.560V
Pin 6 SBU1.......................0.520V
Pin 7 SBU2.......................0.518V
Pin 8 HPD........................0.645V

Fault Interpretation:
HS lines <0.200V → P13USB internally shorted
HS lines OL → trace damage
3.3V = 0V → P13USB shorting entire 3.3V system
SBU1/2 0.000V → shorted ESD diodes
HPD 0.000V → dock detect line broken

BQ24193 Battery Charger (Pin Numbers + Readings)

Pin 1 SW (to inductor)..........0.018–0.020V
Pin 2 SYS Output................0.010–0.020V
Pin 3 VBAT Input................0.625V
Pin 4 VBUS Input................0.460V / OL
Pin 5 ILIM......................0.480V
Pin 6 STAT......................0.600V
Pin 7 TREG......................0.585V

Fault Interpretation:
SW >0.100V → VSYS short or bad inductor
SYS = 0V → no VSYS output, dead BQ
VBUS reads both ways = short on port/M92T/P13USB
BAT <0.500V → battery connector/traces
STAT = 0V → BQ not starting
ILIM = 0.000V → current limit resistor open

MAX77620 PMIC (Pin Numbers + Diode Values)

Pin numbers vary by board revision; values below match top/bottom pads.

Pin EN0.........................0.240V
Pin 1V8 Output.................0.680V
Pin 1V0 CPU....................0.430–0.470V
Pin 1V1 CPU....................0.520V
Pin 2V9........................0.600–0.640V
Pin VSYS Input.................0.010–0.020V
Pin I2C CLK....................0.520V
Pin I2C SDA....................0.550V
Pin GPIO lines................0.550–0.600V

Fault Interpretation:
1V0 <0.300V → CPU rail short
1V0 OL → no PMIC connection
1V8 <0.500V → RAM or CPU short
EN0 = 0V → bad power ribbon, bad resistor
VSYS >0.050V → BQ shorting VSYS rail

MAX77621 / MAX77812 Vcore Regulators

Pin VCORE......................0.420–0.480V
Pin ENABLE.....................0.250V
Pin FEEDBACK...................0.600V
Pin PGOOD......................0.560V

Fault Interpretation:
VCORE 0.000V → regulator or CPU short
VCORE >0.600V → regulator failure
PGOOD = 0 → regulator not enabling second stage

MAX17050 Fuel Gauge IC

Pin SDA.........................0.560V
Pin SCL.........................0.545V
Pin THERM.......................0.620V
Pin ALERT.......................0.575V
Pin BAT_SENSE...................0.010–0.020V

Fault Interpretation:
THERM = 0 → fuel gauge blocking charge
SDA/SCL OL → line broken
BAT_SENSE >0.040V → trace lifted

LCD Connector (Common Readings)

Backlight Pin...................0.380–0.420V
LCD_VDD........................0.620V
Touch Data......................0.480–0.520V
Ground/Shield...................0.000V

Fault Interpretation:
Backlight <0.200V → short on backlight driver
Touch line = 0 → torn FPC

USB-C Port (Pin Numbers + Diode Values)

A pins:
A1 VBUS.........................OL / 0.003V
A2 GND..........................0.000V
A5 CC1..........................0.520V
A6 D+...........................0.425V
A7 D-...........................0.430V
A8 SBU1.........................0.520V

B pins:
B1 VBUS.........................OL / 0.003V
B2 GND..........................0.000V
B5 CC2..........................0.518V
B6 D+...........................0.425V
B7 D-...........................0.430V
B8 SBU2.........................0.518V

Fault Interpretation:
Any pin = 0.000V → shorted port or ESD
Any pin OL both ways → broken trace

CPU / RAM / EMMC Lines (Known-Good Ranges)

CPU Core........................0.430–0.470V
PLL.............................0.540V
RESET...........................0.560V

RAM Data........................0.480V
RAM Address.....................0.520V
RAM VDD.........................0.680V

eMMC CMD........................0.520V
eMMC CLK........................0.520V
eMMC DAT0–7.....................0.480–0.500V
eMMC VCCQ.......................0.680V
eMMC VCC........................0.600V

Fault Interpretation:
All eMMC data <0.300V → shorted eMMC
All eMMC data OL → cracked BGA
RAM VDD low (<0.500V) → RAM short

Power Rail Reference Table

1V0.............................0.430–0.470V
1V1.............................0.520V
1V8.............................0.680V
2V9.............................0.600–0.640V
3V3.............................0.560V
VSYS............................0.010–0.020V
VBAT............................0.625V
VBUS............................0.460V

END FAULT CHART
END OF SWITCH BOARD TROUBLESHOOTING GUIDE

### PLAYSTATION 5 (PS5) STANDBY AND POWER CHECKS

Check that the internal power supply outputs 12V to the motherboard.
If console beeps when pressing the power button, proceed.

With 12V present, verify standby regulators:

12V standby rail:
All large capacitors on the lower area of the board should show 12V.

3.3V regulator:
Located at bottom left of USB ports.
Should have 5V input and 3.3V output at the inductor.

2V regulator:
Located under ribbon to Blu-ray drive.
Should have 5V input and 2V output at the inductor.

1.8V and 1.1V rails:
1.8V should be present in standby.
Pressing power button creates 1.1V rail.

Check fuses:
F7001, F7002, F7003, F5401, F5402, F3501, F7501.

### PLAYSTATION 5 HDMI PORT PROCEDURE

HDMI port is weak from factory. Pins often fracture with slight movement.

Removal:
Heat from underside using hot air at 500C, 120% airflow.
Apply heat for 6 to 8 minutes until connector lifts freely.
Do not pry; wait until fully molten.

Cleanup:
Use flux and wick to remove old solder.
Mix leaded solder to lower melting point.
Use iron at 420C to clear holes.

Small capacitor near HDMI: 0201 size, 220nF.

### PS5 NO POWER DIAGNOSIS

Check PSU outputs 12V at motherboard connector.
Check for shorts around Southbridge CXD90061GG.
Inject 12V from bench supply. If no 300mA boot pattern, remove BIOS IC for 10 to 20 minutes, then resolder. If no change, reflash BIOS using a known-good digital edition BIOS.

BIOS chip marking: 25Q16JVNIM.

### PS5 NO IMAGE / NO SOUND

Check HDMI port for bent pins or debris.
Inspect HDMI port pads for lifted or cracked solder joints.

Check four HDMI chokes (L3001, L3002, L3003, L3004) for continuity in pairs.
Check around HDMI encoder MN864739 for liquid damage or shorts.

Required voltages for HDMI circuit:
5V, 3.3V, 1.8V, 0.9V

Replace HDMI port using hot swap (remove old port, insert new port while solder is still molten).

Check anchor point flood solder top and bottom side.

Replace or reflow HDMI chokes if needed.

HDMI encoder MN864739 replacement:
Use preheater if possible.
Heat encoder from top until solder melts.
Lift chip.
Wick old solder. Add fresh solder.
Align new encoder using orientation marker.
Reflow until chip settles by surface tension.
Inspect for bridges.

### PS5 FAN NOT WORKING

Test with a known good fan.
If new fan does not spin, inspect fan FPC connector.

Fan uses 12V main rail. If console turns on, 12V is OK.

PS5 fan FPC diode readings:
PWM 0.491
GND 0.000
12V 0.431

No PWM reading:
Possible cracked trace, bad Southbridge ball, or dead Southbridge CXD90061GG or CXD90069GG.

Short on PWM line = replace Southbridge.

If FPC is ripped, rebuild using wick and replacement connector.

Southbridge replacement:
Remove CMOS battery.
Use hot air without nozzle; preheat board.
Lift chip carefully.
Clean pads.
Install matching Southbridge.
Clean flux.
Reconnect CMOS.
Test console functions.

### PS5 THREE BEEPS (EVERY 30 SECONDS)

Usually BIOS (NOR) corruption.

Fix 1:
Use UART.
Send command: errlog clear
This clears error database.

If not fixed:
Remove BIOS IC 25Q16JVNIM.
Read chip via SOP8 adapter.
Fix BIOS dump using PS5 NOR Editor tool.
Reflash modified dump.
Resolder BIOS chip.

### PS5 PRO NO POWER

Check PSU 12V.
If no 12V, unplug PSU and check diode mode at motherboard PSU positive terminal:
Normal is 0.400 to 0.500.
If 0.000, 12V rail is shorted.

If 12V present:
Check 5V regulator coil for 5V.
If no 5V, check 5V rail for short.

Check Southbridge voltages.
Check all fuses FXXXX.
If PMIC missing 1.15V or 3.3V, check 5V input. Replace PMIC if 5V present but no outputs.

Shorted caps near PMIC and fuses F7002, F7502 are common.

Southbridge IC same as PS5 Slim (CXD90069GG).

### PLAYSTATION 4 PULSING BLUE LIGHT OF DEATH

Possible causes:
Bad hard drive.
APU solder failure.
Faulty RAM.

Check:
Boot to Safe Mode with HDD removed (HDD fault).
Apply pressure to APU while powering on (BGA fault).
Thermal camera to inspect RAM heat (RAM fault).
Reflow or reball APU if confirmed.

### PS4 PRO NO IMAGE / NO SOUND

Common failures:
HDMI port.
HDMI encoder MN864729.
HDMI chokes.

Check HDMI port pins and pad connections.
Check chokes (L series).
Check MN864729 for cracks or shorts.
Verify HDMI rails:
5V, 3.3V, 1.8V, 0.9V

Replace HDMI port using hot swap method.

Replace HDMI chokes if any lack continuity.

Replace MN864729 using reflow and proper alignment.
Inspect under microscope.

### PLAYSTATION 3 SLIM BLUE SCREEN OF DEATH (BSOD)

Usually LAN circuit failure.
Check LAN port for damage.
Check for shorts around Ethernet controller 88E1118R-NNC2.

If short is present:
Inject current and check for heating.
Replace LAN controller with matching marking code.

Clean pads and reflow replacement IC.

### PLAYSTATION SERIES DIODE MODE REFERENCE VALUES

Note:
All readings may vary by ±0.030V depending on multimeter, probe pressure, board revision, and temperature.
These values represent real-world measurements from working consoles.

-----------------------------------------
PS5 HDMI ENCODER MN864739 (PIN DIODES)
-----------------------------------------
Pin 1  TMDS A+.....................0.428
Pin 2  TMDS A-.....................0.430
Pin 3  TMDS B+.....................0.428
Pin 4  TMDS B-.....................0.430
Pin 5  HPD..........................0.645
Pin 6  SCL..........................0.520
Pin 7  SDA..........................0.518
Pin 8  5V detect....................0.600
Pin 9  3.3V........................0.560
Pin 10 Ground.......................0.000

Fault Signs:
Any TMDS line <0.200 = shorted choke or port damage
HPD = 0 = encoder not communicating
SCL/SDA = OL = ripped trace or liquid damage
3.3V = 0 = short from encoder or nearby cap

-----------------------------------------
PS5 SOUTHBRIDGE CXD90061GG / CXD90069GG
-----------------------------------------
Pin VDD 1.8V.......................0.680
Pin VDD 3.3V.......................0.560
Pin RST............................0.560
Pin CLK............................0.520
Pin DATA...........................0.480 to 0.520
Pin PWM FAN........................0.491

Fault Signs:
VDD 3.3V = 0 → dead Southbridge
PWM fan = 0 → fan never spins
CLK OL → Southbridge BGA lifted

-----------------------------------------
PS5 FAN FPC DIODE VALUES
-----------------------------------------
PWM...............................0.491
12V...............................0.431
GND...............................0.000
TACH..............................0.520

Fault Signs:
PWM OL → trace crack or Southbridge failure
TACH 0.000 → blown transistor or dead fan

-----------------------------------------
PS5 HDMI PORT (ON-MOTHERBOARD)
-----------------------------------------
A1 VBUS...........................OL / 0.003
A2 GND............................0.000
A5 CC.............................0.520
A6 D+.............................0.425
A7 D-.............................0.430
A8 SBU............................0.520

B1 VBUS...........................OL / 0.003
B2 GND............................0.000
B6 D+.............................0.425
B7 D-.............................0.430
B8 SBU............................0.518

Fault Signs:
Any data pin = 0 → port ESD destroyed
Any data pin = OL → lifted pad

-----------------------------------------
PS4 PRO HDMI ENCODER MN864729
-----------------------------------------
Pins mirror MN864739 except:
Data lines range.................0.420–0.460
5V detect........................0.600
HPD..............................0.645

Common Faults:
Data line <0.200 → shorted choke
5V detect 0 → blown 5V regulator
HPD 0 → encoder not enabling output

-----------------------------------------
PS3 SLIM LAN CONTROLLER 88E1118
-----------------------------------------
TX+...............................0.480
TX-...............................0.475
RX+...............................0.480
RX-...............................0.475
3.3V..............................0.560
PHY CLK...........................0.520

Fault Signs:
Any line = 0 → shorted LAN IC (most common PS3 BSOD)
3.3V 0 → LAN IC dead, replace

### PLAYSTATION 3 — POWERS ON THEN SHUTS DOWN (1–2 SECONDS)

This fault is extremely common across PS3 FAT, Slim, and Super Slim models.
Symptoms may include:
• Brief green light → yellow → flashing red (YLOD)
• Brief green light → immediate red blinking (shutdown protection)
• Fans spin for <2 seconds then cut off
• No video output before shutdown

Below are real-world causes and correct diagnostic sequence.

------------------------------------------------------------
## 1️⃣ CHECK POWER SUPPLY (PSU) OUTPUT
------------------------------------------------------------
PS3 has internal PSU. If it is unstable, it cuts power instantly.

Steps:
1. Remove PSU from shell but keep connected.
2. Multimeter DC mode:
   - Yellow wire: +12V
   - Other rails vary per model but +5V standby should be stable.
3. Press power → check if 12V sags or drops out.

If 12V drops fast → bad PSU.
If 12V stable → move to next step.

------------------------------------------------------------
## 2️⃣ CHECK FOR SHORT ON 12V RAIL (VERY COMMON)
------------------------------------------------------------
PS3 will shut down instantly to protect PSU.

Steps:
1. Console unplugged.
2. Multimeter → diode mode.
3. Check resistance/diode reading to ground on 12V rail input caps.

Expected:
• Normal diode reading: 0.350–0.550
• Short: 0.000 or extremely low, beeping.

If shorted:
Common culprits:
• NEC/Tokin capacitors (FAT models)
• Shorted MLCC around CPU/GPU rails
• Blown MOSFET feeding CPU/GPU

------------------------------------------------------------
## 3️⃣ CHECK NEC/TOKIN CAPACITORS (PS3 FAT ONLY)
------------------------------------------------------------
Most famous cause of PS3 “switch on then die.”

The big NEC/Tokin caps fail and cannot deliver stable current, so console instantly shuts off.

Symptoms:
• Yellow → red blinking
• No fan ramp
• Shuts off without warning during gameplay

Test:
1. Press power → monitor 12V rail.
2. If rail dips or oscillates → NEC caps bad.

Fix:
• Replace NEC/Tokin with 4× 470µF tantalum per chip (16V recommended).

------------------------------------------------------------
## 4️⃣ REBALLING / REFLOW ISSUES (RSX / CELL)
------------------------------------------------------------
FAT and early SLIM models often shut down due to **cracked RSX solder joints**.

Symptoms:
• Green → yellow → red blink (YLOD)
• Shuts off before video appears
• No shorts present
• PSU stable

Diagnosis:
1. Light pressure test:
   - Gently press on RSX → try powering on.
   - If PS3 stays on longer → RSX BGA issue.
2. Hot air (low heat) pre-warm test:
   - If console stays on longer when warm → confirms BGA microfractures.

Fix:
• Professional reball of RSX
• OR thermal reflow (temporary fix)

------------------------------------------------------------
## 5️⃣ CHECK FAN / THERMAL CONTROL (AUTO SHUTDOWN)
------------------------------------------------------------
If fan does NOT spin at startup:
PS3 will shut off within seconds to avoid thermal runaway.

Check:
1. Fan connector seated?
2. Does fan twitch at power-on?
3. 12V to fan output rail present?

If no movement:
• Replace fan
• Check fan transistor & fan driver IC
• Inspect F620x fuses (model-dependent)

------------------------------------------------------------
## 6️⃣ FUSES (F600x SERIES) — SLIM & SUPER SLIM
------------------------------------------------------------
Fuses around RSX/CELL can blow and cause instant shutdown.

Check:
• F6201
• F6202
• F6203
• F6301
(Varies by model)

Multimeter continuity test:
• Good fuse → beep
• Bad fuse → open circuit

If any CPU/GPU power fuse is blown:
→ board shuts down as soon as load begins.

------------------------------------------------------------
## 7️⃣ SHORT ON GPU OR CPU RAILS
------------------------------------------------------------
If CELL or RSX internal power rail is shorted → instant shutdown.

Check:
1. Measure inductors around CPU/GPU.
2. Diode reading to ground.

Expected:
• RSX: ~0.350–0.550
• CELL: ~0.400–0.600

If reading is 0.000 or near-short → internal chip short (not repairable).

------------------------------------------------------------
## 8️⃣ SUPER SLIM: LID SENSOR + POWER LOGIC
------------------------------------------------------------
Super Slim will shut down immediately if:

• Lid sensor flex is damaged
• Switch not detected
• Disc drive logic error on boot

Test:
• Boot with lid sensor flex removed
• Boot with drive fully connected

If console stays on only in certain combinations → replace sensor/drive flex.

------------------------------------------------------------
## 9️⃣ CHECK HDMI/AV SHORT (RARE)
------------------------------------------------------------
Sometimes blown HDMI filters or ESD chips cause PS3 to shut down.

Check:
• HDMI ESD IC not shorted
• No blown EMI filters
• Diode reading on HDMI pins normal (~0.450)

If HDMI line shorted → PS3 shuts off during initialization.

------------------------------------------------------------
## 🔥 SUMMARY FLOWCHART
------------------------------------------------------------
1. PSU 12V OK?
   - No → replace PSU
2. Short on 12V?
   - Yes → find shorted MLCC/MOSFET/NEC caps
3. FAT model?
   - Yes → test/replace NEC/Tokin capacitors
4. Fans spin?
   - No → repair fan/fuse/driver IC
5. Fuses OK?
   - No → replace fuse + check load
6. CELL/RSX diode values normal?
   - No → internal short → unrepairable
7. Suspect RSX BGA?
   - Press test → if changes → reball/reflow
8. Super Slim?
   - Check lid sensor + disc drive flex
9. HDMI/AV short?
   - Replace ESD/EMI filter

Console should now power normally or fault is isolated.


### PS5 EDM-030 — 1.2V RAIL CYCLIC COLLAPSE (SONICS BUS ERROR)

ISSUE OVERVIEW
• 1.2V rail reaches 1.20V
• Rapidly collapses (0.6V → 0.2V)
• Recovers back to 1.20V
• Repeats until shutdown

RAIL ANALYSIS
• Regulator is NOT the fault
• Regulator is being shut down by PMIC fault detection
• Pattern indicates load failure, not source failure
• Load (Southbridge domain) is failing initialization
• PMIC retries → fails → retries → fails

FAULT CORRELATION
• Error Code: B0088108 — Sonics Bus Error
• Rail behavior matches internal logic failure

ROOT CAUSE
• Southbridge BGA / internal failure
• Internal bus logic inside Southbridge is shorting or timing out
• Chip draws excessive current during init
• Power management shuts rail down to protect itself
• Common on EDM-030 with previous heat, liquid exposure, or thermal cycling

WHAT IT IS NOT
• Not NOR firmware
• Not SSD
• Not HDMI
• Not software
• Not something a reflow will fix

REPAIR OPTIONS

OPTION 1: SOUTHBRIDGE REBALL
• Only real repair option
• Remove Southbridge
• Inspect pads
• Reball with correct alloy
• Reinstall
• Note: High risk, time-consuming, requires stencil/skill

OPTION 2: SOUTHBRIDGE REPLACEMENT
• Requires donor board
• High failure rate
• Not economical unless learning

OPTION 3: SCRAP / PARTS BOARD
• Best choice for most shops
• Keep PSU, fan, heatsinks, Wi-Fi module

WHAT NOT TO DO
• Do NOT attempt another reflow (will make it worse)
• Do NOT "press harder" or apply longer heat
• Do NOT flash firmware
• Do NOT replace random regulators

FINAL DIAGNOSIS
• Model: PS5 EDM-030
• Fault: B0088108 Sonics Bus Error
• Cause: Southbridge internal or BGA failure
• Evidence: 1.2V rail cyclic collapse under load
• Result: Hard electrical proof of hardware failure


### IPHONE RANDOM RESTART OVERVIEW

Many iPhone models restart every 2 to 5 minutes when required sensors or flex cables are missing, defective, or liquid damaged. These sensors must be detected at boot. If missing, device restarts approximately every 180 seconds.

Common restart scenarios:
After back glass repair
After charging port replacement
After battery replacement
After screen replacement
During normal usage
Device freezes then reboots
Bootloop every 3 minutes
Charging shows 0 percent
Battery does not report percentage

### PANIC LOG DIAGNOSTICS FOR ALL MODELS

To find panic log:
Settings > Privacy > Analytics and Improvements > Analytics Data
Open the newest file starting with panic-full

Search for:
Missing Sensors:
SMC PANIC - ASSERTION FAILED
Sensor Array
TG0B
TG0V
PRS0
MIC1
MIC2
Codes in hex (0x values)

Tools to analyze:
iDevice Panic Log Analyzer
PanicFull.com

Required note:
Panic log tools give suggestions only. No official list from Apple exists. Always verify manually.

------------------------------------------------------------
### IPHONE X RANDOM RESTART
------------------------------------------------------------
Common causes:
Defective battery (no percentage shown)
Charging port flex damaged
Back glass damage affecting charging flex
Loose or damaged connectors

Panic log signs:
TG0B or TG0V indicates battery related
Battery defective
Battery connector damaged
Battery data lines missing
Check Q3201 and Q3200 MOSFETs near battery

Diode checks:
I2C0_SMC_TO_GG_SCL_CONN
I2C0_SMC_BI_GG_SDA_CONN
If OL, data line is disconnected

PRS0 or MIC1 indicates charging port flex
Check resistors around connector

Repair steps:
Use OEM or premium parts only
Test with known good flexes
Ensure required flex cables are connected
Check for pry damage around connectors
Do not troubleshoot with flex unplugged; phone will restart automatically

------------------------------------------------------------
### IPHONE XS AND IPHONE XS MAX RANDOM RESTART
------------------------------------------------------------
Same core design as iPhone X.

Common causes:
Bad or defective battery
Charging port flex damage
Battery data lines missing

Panic log:
TG0B or TG0V = battery issue
Check Q3201 and Q3200
Check battery data pins
PRS0 or MIC1 = charging port flex

Repair steps:
Test with premium OEM parts
Check resistors around port
Inspect for liquid damage
Use known good flexes

------------------------------------------------------------
### IPHONE 11 RANDOM RESTART
------------------------------------------------------------
Common causes:
Bad battery or missing battery data
Charging port flex damaged
Power button flex damaged (mic2)
Board sandwich separation after drop

Additional cause:
Secondary microphone on power button flex (mic2) missing or damaged

Panic log keywords:
TG0B or TG0V = battery lines
I2C2_SMC_SCL_CONN and I2C2_SMC_SDA_CONN diode test
Check R3202 and R3201 resistors for missing values

PRS0 or MIC1 = charging port
Check R6822 (I2C1_AOP_SCL)
Check R6823 (I2C1_AOP_SDA)

MIC2 = power button flex
If OL on connector, board separation is possible

Repair steps:
Test known good battery
Test known good charging port
Test known good power button
Check for sandwich separation (requires board-level repair)
Ensure all sensors connected

------------------------------------------------------------
### IPHONE 11 PRO AND 11 PRO MAX RANDOM RESTART
------------------------------------------------------------
Common causes:
Bad battery
Charging port flex damage
Power button flex mic2 damage
Liquid damage near connectors

Panic log:
TG0B or TG0V = battery issue
Check PMU_TO_BATTERY_SWI for diode reading

PRS0 or MIC1 = charging port
MIC2 = power button flex

Repair steps:
Always use OEM flex
Inspect for pry damage around power button connector
Check resistors around port and battery connector

------------------------------------------------------------
### IPHONE 12 SERIES RANDOM RESTART
------------------------------------------------------------
Common causes:
Bad or defective battery
Charging port flex damaged
Back glass damage affecting charge coil flex

Panic log codes:
TG0B or TG0V = battery
Check data pins I2C2_SMC_SDA_1V8 and I2C2_SMC_SCL_1V8
Check resistors:
R2473
R2472
R2475

PRS0 or MIC1 = charging port
Eiger = charging port system flex

Repair steps:
Use OEM flexes
Test with known good charging port and battery flex
Do not unplug sensors during testing

------------------------------------------------------------
### IPHONE 13 SERIES RANDOM RESTART
------------------------------------------------------------
Common causes:
Proximity flex damaged (screen flex)
Charging port flex damaged
Bottom board communication issue (iPhone 13 mini)
Board sandwich separation

Panic log codes:
0x1000 = proximity flex
0x800 = charging port flex
0x1800 = both flexes
0x400 = sandwich separation
0xc00 = charging port + sandwich issue
0x4000 = battery data line on 13 mini

Repair notes:
iPhone 13 mini gyro lines on bottom board
Rebuild pads:
207
208
502
503
504
527
528

Repair steps:
Test OEM prox flex
Test OEM charge port
Check for tears, liquid, or pry damage
Inspect sandwich edges for separation

------------------------------------------------------------
### IPHONE 14 SERIES RANDOM RESTART
------------------------------------------------------------
Common causes:
Wireless charging flex (back glass)
Proximity flex (screen)
Charging port flex
Sandwich separation

Panic log codes:
0x400000 = wireless charging flex
0x100000 = charging port flex
0x500000 = taptic engine or battery communication
0x200000 = proximity flex
0x600000 = wireless + proximity flex
0x20000 = logic board sandwich issue

Repair steps:
Check all flexes plugged in
Use OEM parts only
Known good flex testing recommended
Inspect for bottom board separation

------------------------------------------------------------
### IPHONE 14 PRO SERIES RANDOM RESTART
------------------------------------------------------------
Common causes:
Proximity flex
Charging port flex
Power button flex
Sandwich separation (gyro U7300 lines)

Panic log codes:
0x80000 = proximity flex
0x40000 = charging port flex
0x10000 = power button flex
0xc0000 = proximity + charging port
0x180000 = proximity + power button
0x140000 = power button + charging port
0x1c0000 = all three flexes
0x20000 = sandwich separation (gyro)
0xa0000 = proximity + sandwich issue
0xa1 = battery data

Gyro U7300 relevant pads:
542
543
544
545
546
6
248

------------------------------------------------------------
### IPHONE 15 AND IPHONE 15 PLUS RANDOM RESTART
------------------------------------------------------------
Common causes:
Wireless charging flex
Charging port flex
Proximity flex
Air pressure sensor
Sandwich separation

Panic log codes:
0x200000 = wireless charging flex
0x80000 = charging port flex or air pressure sensor
0x100000 = proximity flex
0x280000 = wireless + charging port
0x380000 = wireless + charging port + proximity

Repair steps:
Test OEM parts
Inspect connectors for liquid or tear damage
Check sandwich edges for separation

------------------------------------------------------------
### IPHONE 15 PRO AND 15 PRO MAX RANDOM RESTART
------------------------------------------------------------
Common causes:
Charging port flex
Back glass wireless charging flex
Proximity flex
Battery data
Sandwich separation

Panic log codes:
0x200000 = proximity flex
0x300000 = charging port flex
0x400000 = wireless charging flex
0x600000 = proximity + wireless
0x700000 = charging port + wireless
0xa1 = battery data issue

Repair steps:
Test with known good OEM flexes
Check battery connector pins for alignment
Check for liquid damage around charging port
Inspect sandwich layers for separation

------------------------------------------------------------
### COMMON PANIC LOG KEYWORD SUMMARY
------------------------------------------------------------
iPhone X to iPhone 12:
mic1 = charging port flex
mic2 = power button flex
prs0 = charging port flex
tg0b / tg0v = battery or battery data
ans2 = NAND related

iPhone 13 series:
0x800 = charging port
0x1000 = prox flex
0x1800 = prox + charge port
0x400 = sandwich

iPhone 14:
0x400000 = wireless charging flex
0x100000 = charging port
0x500000 = battery communication or taptic engine
0x200000 = proximity

iPhone 14 Pro:
0x80000 = prox flex
0x40000 = charging port
0x10000 = power button
0x20000 = sandwich

iPhone 15:
0x200000 = wireless charging
0x80000 = charging port
0x100000 = proximity

iPhone 15 Pro:
0xa1 = battery
0x300000 = charging port
0x400000 = wireless charging
0x700000 = charge + wireless

### IPHONE POWER FLOW CHART (UNIVERSAL)

This section describes the universal iPhone power-on sequence from the moment power is applied to full boot. Each stage lists what must be present, what chips participate, what can fail, and what symptoms appear.

The flow is linear. If one stage fails, the next stage cannot begin.

------------------------------------------------------------
STAGE 0: INITIAL POWER SOURCES
------------------------------------------------------------
This is before the device attempts to boot.

Power sources:
Battery BATT_VCC (3.7 to 4.3V depending on charge)
USB-C or Lightning input (5V)
Wireless charging coil (5V)

Required working components:
Battery connector
Tigris (older models: Tristar/Hydra)
Charging port flex
Back glass wireless coil flex (12–15 series)
Fuse on input line
Main power rails not shorted

Symptoms when Stage 0 fails:
Device shows 0% and never increases
Random restarts every 3 minutes
Device shuts off when unplugged
No charging symbol
Tristar/Hydra overheating
Short on main VBUS line
Panic logs show tg0b or battery data codes

Common faults:
Bad battery
Bad battery connector
Bad charging port
Short on 5V line
Charge IC failure
Liquid damage near port

------------------------------------------------------------
STAGE 1: POWER MANAGEMENT IC (PMIC MAIN) RECEIVES POWER
------------------------------------------------------------
Once battery voltage is present, PMIC_MAIN powers up.

Tasks PMIC performs:
Checks battery data (I2C lines)
Enables low-voltage rails needed for pre-boot
Confirms there is no short on main VDD_MAIN
Prepares SMC / SEP for handshake

Rails enabled in this stage:
PP1V8_S2
PP3V0_S2
PP3V0_S1
PP1V1_S1
(depends on model, but these low rails are mandatory)

Symptoms when Stage 1 fails:
Phone is totally dead
No response to power button
No current draw on DC power supply
Board stays at 0.00A
Panic log: tg0b, battery, PMU, gas gauge issues

Common faults:
PMIC short
PP_VDD_MAIN short
Short on PP1V8 or PP3V0
Gas gauge (battery data) missing
PMIC balls lifted or cracked

------------------------------------------------------------
STAGE 2: TRISTAR / HYDRA HANDSHAKE (A8–A13 MODELS)
------------------------------------------------------------
This stage applies to Lightning iPhones (X–11 mostly).
USB-C iPhones (15 series) skip Tristar.

Tasks:
Detects USB power
Negotiates communication between:
USB > PMIC
USB > CPU
USB > Battery Gas Gauge

If charging port or Tristar fails, PMIC will not proceed.

Symptoms when Stage 2 fails:
Boot loop every 180 seconds
Device boots only when battery full
Device restarts when plugged in
“No accessory supported”
Random shutdowns
Slow charging / no charging

Common faults:
Bad charging port flex
Bad Tristar/Hydra
Bad ESD diodes near connector
Liquid damage

------------------------------------------------------------
STAGE 3: SMC / GAS GAUGE BATTERY DATA VALIDATION
------------------------------------------------------------
The battery communicates digitally with the logic board.

The PMIC will NOT allow next stage unless battery data is valid.

Data lines:
Older models: I2C0_SMC
iPhone 11–15: I2C2_SMC
iPhone 13–15: Battery communicates with PMU → SEP → CPU

Battery must provide:
Battery temperature
Battery percentage
Battery health
Gas gauge data

Symptoms when Stage 3 fails:
Random shutdown every 3 minutes
Shows 0% forever
Battery percentage jumps randomly
Panic logs show:
TG0B
TG0V
0xa1
battery_data
Missing Sensors

Common faults:
Bad battery
Damaged battery connector
Broken I2C line under CPU
Burnt battery data resistors
Liquid damage near battery connector

------------------------------------------------------------
STAGE 4: SECONDARY POWER RAILS ENABLE
------------------------------------------------------------
Once battery data is verified, PMIC turns on high-current rails:

Rails include and vary by model:
PP_CPU
PP_GPU
PP_SOC
PP_VDD_MEM
PP_VDD_MAIN_SUB
PP1V1_S3
PP0V9
PP1V2

These rails feed:
CPU
GPU
RAM
NAND storage

Symptoms when Stage 4 fails:
Phone vibrates but no image
Apple logo loops
Stalls at black screen
Freezes then shuts off
Current draw freezes (DC power supply)

Common faults:
Short on RAM rail
Short on CPU rail
Bad PMIC for CPU (iPhone 7/7+ common)
Bad PMIC_MAIN solder balls
Bad Tigris/charging IC feeding rails
Corrupt OS
Bad NAND / storage failure

------------------------------------------------------------
STAGE 5: CPU AND SEP INITIALIZATION
------------------------------------------------------------
The CPU and Secure Enclave Processor wake up next.

Tasks:
Load bootloader
Check SEP pairing
Check NAND integrity
Check board serials
Load kernel
Check sensors

Sensors must respond correctly or panic occurs.

Required sensors in this stage:
Proximity flex (X–15)
Wireless charging flex (12–15)
Charging port flex (X–15)
Back glass flex (12–15)
Mic1 / Mic2 (varies by model)

Symptoms when Stage 5 fails:
Panic log restarts
3-minute boot loop
Device resets when opening camera
Device resets during calls
FaceID disabled
Black screen after Apple logo

Common panic log codes:
mic1
mic2
prs0
0x800
0x1000
0x1800
0x400000
0x200000

Common faults:
Torn proximity flex
Bad charging port
Bad wireless charging flex
Bad power button flex
Sandwich separation on mini / 14 / 15 Pro series

------------------------------------------------------------
STAGE 6: NAND INITIALIZATION AND KERNEL LOAD
------------------------------------------------------------
Storage must respond correctly.

Tasks:
NAND sends boot arguments
CPU loads kernel
Baseband firmware loads

Symptoms when Stage 6 fails:
Boot loop at Apple logo
Progress bar freezes
Phone heats up then restarts
Panic logs:
ANS2
NAND
Baseband panic

Common faults:
Bad NAND
Corrupt OS
Baseband short (X–11)
Missing baseband PMIC rails
Tristar feeding baseband wrong voltage (older models)

------------------------------------------------------------
STAGE 7: IMAGE SIGNAL PROCESSOR AND DISPLAY POWER UP
------------------------------------------------------------
Display and camera systems activate.

Tasks:
Touch controller online
Display backlight enables
Camera sensors initialize
FaceID dot projector checks (X–12)

Symptoms when Stage 7 fails:
No image but phone vibrates
Dim backlight
Boot loop only when screen attached
Black screen but system makes sounds

Common faults:
Bad screen (prox flex missing)
Bad backlight circuit
Missing sensor flex
Damaged FPC connector

------------------------------------------------------------
STAGE 8: FULL BOOT TO SPRINGBOARD (HOME SCREEN)
------------------------------------------------------------
The final stage includes:
Baseband handshake
Wi-Fi power rails
BT initialization
Thermal sensor validation
Taptic engine initialization

Symptoms when Stage 8 fails:
Phone boots but restarts randomly
Overheating
Baseband no service
Wi-Fi greyed out
Taptic engine failure
Camera not available

------------------------------------------------------------
### FLOW SUMMARY (CONDENSED)
------------------------------------------------------------
Battery → PMIC → Low rails → Tristar/Hydra → Battery Data → High rails → CPU/SEP → Sensors → NAND → Display → Full Boot

Failure of any sensor or flex in iPhone X–15 causes a forced restart every 180 seconds.

Failure of battery data causes 0% and random reboots.

Failure of PMIC rails causes no power.

Failure of CPU/SEP causes boot loops.

Failure of NAND causes Apple-logo loops.

Failure of proximity or charging port flex causes 3-minute restart cycles.

Failure of wireless charging flex (12–15) causes instant panic logs.

------------------------------------------------------------
### QUICK DIAGNOSTIC FROM CURRENT DRAW (DC BENCH)
------------------------------------------------------------
0.00A → PMIC or VDD_MAIN short
0.02–0.10A → Stuck at low rails (battery data missing)
0.15A → Panic loop beginning
0.20–0.30A → CPU failing to initialize
0.40–0.60A → Booting but sensor missing
0.80–1.2A → Full OS load
Spikes to 1.6A → Display backlight enabling
Stable 0.1A after 3 minutes → Restart loop (sensor missing)

### IPHONE PMIC POWER RAIL MAP (UNIFIED)

------------------------------------------------------------
RAIL: PP_VDD_MAIN
------------------------------------------------------------
Voltage: Battery voltage (3.7–4.35V)
Feeds: Entire board, PMIC core, USB, PMU subcircuits
Failure Symptoms:
• Dead phone
• No current draw
• Short to ground = phone instantly 0 amps or goes into protect
Common Faults:
• Shorted caps near PMIC
• Tigris/Hydra shorting main
• Backlight filter short
• Liquid damage

------------------------------------------------------------
RAIL: PP_BATT_VCC
------------------------------------------------------------
Voltage: Battery direct (3.7–4.35V)
Feeds: PMIC battery input, charge IC
Failure Symptoms:
• Shows 0%
• Shuts off when unplugged
• Random shutdowns
Common Faults:
• Bad battery
• Bad connector
• Torn data lines

------------------------------------------------------------
RAIL: PP1V8_S2 (1.8V always-on rail)
------------------------------------------------------------
Feeds: NAND, CPU low-level logic, sensors, Tristar/Hydra
Failure Symptoms:
• No power
• Panic logs referencing sensors
• CPU never boots
Common Faults:
• Short near NAND
• Short near proximity flex area
• Bad PMIC

------------------------------------------------------------
RAIL: PP3V0_S2 (3.0V always-on)
------------------------------------------------------------
Feeds: Baseband, PMU communication rails, logic sensors
Failure Symptoms:
• No service
• Baseband panic
• No image (sometimes)
Common Faults:
• Baseband PMIC short
• PMU output failure

------------------------------------------------------------
RAIL: PP0V9_S1 / PP1V1_S1 / PP1V2_S1 (CPU core rails)
------------------------------------------------------------
Feeds: CPU, SEP
Failure Symptoms:
• Device vibrates but no image
• Apple logo loop
• Panic full logs referring to CPU
Common Faults:
• RAM short
• CPU short
• Bad PMIC core rail

------------------------------------------------------------
RAIL: PP_GPU / PP_CPU_GFX
------------------------------------------------------------
Feeds: GPU sub-processor
Failure Symptoms:
• Restarts under load (gaming/video)
• Device gets hot
Common Faults:
• GPU short
• Bad PMIC output

------------------------------------------------------------
RAIL: PP_VDD_MEM (RAM)
------------------------------------------------------------
Voltage: 1.2–1.3V depending on model
Feeds: DRAM package-on-package
Failure Symptoms:
• Apple logo loop
• Freezes
• Touch-enabled but no image
Common Faults:
• Bad RAM
• CPU/RAM separation (11/12 common)

------------------------------------------------------------
RAIL: PP3V0_NAND / PP1V8_NAND
------------------------------------------------------------
Feeds: NAND storage
Failure Symptoms:
• Boots then restarts
• Stuck on Apple logo
• ANS2 panic
Common Faults:
• Bad NAND
• Short near storage IC
• Corrupt OS

------------------------------------------------------------
RAIL: PP_RETINA / PP_LCD_BACKLIGHT
------------------------------------------------------------
Feeds: LCD backlight IC
Failure Symptoms:
• Black screen but phone on
• Dim screen
Common Faults:
• Backlight filter short
• Bad FPC damage

------------------------------------------------------------
RAIL: PP1V8_CAM / PP2V8_CAM
------------------------------------------------------------
Feeds: Camera subsystem
Failure Symptoms:
• Camera not available
• Freeze → restart
Common Faults:
• Short near camera PMU
• Liquid in camera area

------------------------------------------------------------
RAIL: PP_WL (Wi-Fi)
------------------------------------------------------------
Feeds: WiFi/BT IC
Failure Symptoms:
• Wi-Fi greyed out
• Device overheating
Common Faults:
• Wi-Fi IC short (iPhone 7 common)

### LIGHTNING DIODE VALUES (iPhone X–14)

Pin 1: 0.520V  (Tristar CC1)
Short = no charge / Apple logo loop

Pin 2: 0.495V  (USB Data +)
Short = No data, slow charging

Pin 3: 0.490V  (USB Data -)
Short = Not recognized by PC

Pin 4: 0.000V (Ground)

Pin 5: 0.520V (Accessory ID / CC2)
Short = accessories not supported

Pin 6: 0.480V (5V detect line)
Short = no charging; Tristar blows

Pin 7: OPEN (Reserved)

Pin 8: OPEN (Reserved)

Pins A1/A12 (5V input): OL to board
Short = instant PMIC shutdown

Pins B1/B12 (GND): 0V

### USB-C DIODE VALUES (iPhone 15 Series)

CC1: 0.308V
CC2: 0.310V
Short → No charging / no power

SBU1: 0.495V
SBU2: 0.498V
Short → No data / no video output

D+ : 0.470V
D- : 0.468V
Short → Slow charge / data error

VBUS pins (4 total): OL to board
Short → PMIC dead / phone dead

GND pins: 0.000V

Symptoms of Sandwich Separation
• Random 3-minute restart
• Losing mic2, gyro, prox, wireless charging flex detection
• Panic logs with:
    0x400
    0x20000
    0x400000
    mic2
    sensor array panic
• Won’t restore in DFU
• Turns on but freezes or no touch
• Current draw spike then instant drop

What disconnects when the sandwich separates
• Gyroscope lines
• Mic2 lines
• Proximity lines
• Wireless charging communication
• Interposer resistor buses
• Middle-layer traces controlling I2C sensor buses

Board Areas That Commonly Crack
• Around CPU corner
• Around PMIC corner
• Under NAND
• Near interposer 207 / 208 pads
• Pads 502–528 region (iPhone 13 mini known case)
• Gyro U7300 area (14 Pro / 15 Pro)

Fix Strategy
Level 1 Repair:
Reflow edges
Reheat mid-layer
Reconnect FPC + check all accessories

Level 2 Repair:
Reball bottom board
Reball top board
Bridge broken pads

Level 3:
Interposer swap
Bottom board replacement

Red Flags = Guaranteed Sandwich Issue
• Code 0x400 or 0x20000 on iPhone 14/15
• Gyro, prox, mic2 all failing together
• Wireless charging flex AND charging port flex both failing in panic logs
• Flexes all known-good but device restarts exactly every 180 seconds

### GPU BASE VOLTAGE RAILS (UNIVERSAL NVIDIA/AMD)

------------------------------------------------------------
## CORE VOLTAGE (Vcore / GFX Rail)
------------------------------------------------------------
Voltage Range:
- 0.7–1.15V (NVIDIA)
- 0.8–1.2V (AMD)
- 0.65–0.95V (Laptop GPUs)

Powers:
- Shader cores, RT cores, tensor cores, compute units.

Symptoms of failure:
- No display
- Fans spin then stop
- Card stuck at 0A draw on DCPS
- Crash under load (VRM droop)
- Hot core with 0V output → internal short

Common faults:
- Shorted MLCC around GPU die
- Blown high-side MOSFET
- No PWM from controller
- Cracked inductor

------------------------------------------------------------
## VRAM VOLTAGES (GDDR5/GDDR6/GDDR6X)
------------------------------------------------------------
### VMEM / VDDQ (Main VRAM Supply)
------------------------------------------------------------
Voltage:
- 1.35–1.5V (GDDR5)
- 1.35V (GDDR6)
- 1.1V (GDDR6X)

Symptoms:
- Checkerboard artifacts
- Corrupted BIOS screen
- Freezing at POST
- Memory errors at load

Common faults:
- Shorted VRAM cap
- Failing VRAM chip
- Dead VMEM MOSFET

------------------------------------------------------------
### VDDCI (Memory Controller)
------------------------------------------------------------
Voltage: 0.9–1.05V
Powers GPU internal memory controller.

Symptoms:
- No display
- GPU detected but driver fails
- Black screen at driver load

------------------------------------------------------------
### MVDD (AMD Only)
------------------------------------------------------------
Voltage: 1.8–2.0V
Symptoms:
- Heavy pixel artifacts
- Card boots but no stable image

------------------------------------------------------------
## AUX / LOGIC / PCIe RAILS
------------------------------------------------------------
### 1.8V Rail (VDDIO / VDD_1V8)
------------------------------------------------------------
Voltage: 1.7–1.9V
Powers:
- BIOS chip
- PCIe logic
- DisplayPort/HDMI logic
- I2C buses

Symptoms:
- GPU undetected
- No BIOS communication
- Fans spin but no display

------------------------------------------------------------
### 3.3V PCIe Rail
------------------------------------------------------------
Voltage: 3.3V–3.35V
Powers:
- PCIe interface
- BIOS chip supply
- EN / PWRGOOD signals

Symptoms:
- GPU not detected
- “Unknown device” in Device Manager
- No driver install

------------------------------------------------------------
### 5V AUX Rail
------------------------------------------------------------
Voltage: 5.0V
Powers:
- GPU fans
- HDMI circuitry
- USB-C controllers

Symptoms:
- Fans dead
- No HDMI activity

------------------------------------------------------------
## PLL / SOC / CLOCK RAILS
------------------------------------------------------------
### PLL Voltage
------------------------------------------------------------
Voltage: 1.0–1.2V
Powers GPU frequency/clock timing.

Symptoms:
- Screen flicker
- Random driver crash
- Stuck at low clocks

------------------------------------------------------------
### SOC Voltage (AMD)
------------------------------------------------------------
Voltage: 0.9–1.1V
Powers display engine + PCIe logic.

Symptoms:
- No image despite fans spinning
- Video playback crashes

------------------------------------------------------------
## GPU POWER-UP SEQUENCE (CRITICAL)
------------------------------------------------------------
Correct order (all GPUs follow):
1. 3.3V PCIe rail
2. 5V AUX rail
3. 1.8V logic rail
4. VRAM rails: VMEM, VDDCI, MVDD
5. Vcore (last rail to activate)
6. PWRGOOD → POST

If any earlier rail is missing → GPU never activates Vcore.

------------------------------------------------------------
## SHORT-CIRCUIT DIAGNOSIS
------------------------------------------------------------
### Vcore short:
- Diode reading < 0.050V
- GPU die heats instantly on DCPS
- 0A draw or instant shutdown

### VRAM short (1.35V rail):
- Diode reading < 0.150V
- Fans spin, no display
- Artifacts when forcing boot

### 1.8V short:
- GPU undetected
- BIOS chip offline

### 3.3V short:
- GPU fans spin
- No detection in motherboard BIOS

### RESPONSE GUIDELINES
1. Always output in clean, formatted Markdown.
2. Use Headers (##), Bullet Points, and Code Blocks for readability.
3. Do not output large blocks of unformatted text.
`;

export default {
  /**
   * Main request handler for the Worker
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle static assets (frontend)
    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // API Routes
    if (url.pathname === "/api/chat") {
      // Handle POST requests for chat
      if (request.method === "POST") {
        return handleChatRequest(request, env);
      }

      // Method not allowed for other request types
      return new Response("Method not allowed", { status: 405 });
    }

    // Handle 404 for unmatched routes
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    // Parse JSON request body
    const { messages = [] } = (await request.json()) as {
      messages: ChatMessage[];
    };

    // Add system prompt if not present
    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    const response = await env.AI.run(
      MODEL_ID,
      {
        messages,
        max_tokens: 1024,
      },
      {
        returnRawResponse: true,
        // Uncomment to use AI Gateway
        // gateway: {
        //   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
        //   skipCache: false,      // Set to true to bypass cache
        //   cacheTtl: 3600,        // Cache time-to-live in seconds
        // },
      },
    );

    // Return streaming response
    return response;
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
