# Laptop tilt

Laptop tilt lets the icon pile respond to the physical angle of a compatible Apple Silicon MacBook. A small foreground helper reads the Mac's accelerometer and sends fresh samples directly to the page over the loopback interface.

## Start

From the Coding Index app directory, run this command in a terminal.

```sh
npm run motion
```

The launcher compiles the helper with your installed Swift compiler when needed, then runs it in the foreground. Keep that terminal open. Open the live Coding Index or the local app on port 3001, then choose **Laptop tilt**. If the browser requests access to devices on your local network, allow that request for the Coding Index page.

Gently tilt the laptop left or right. The page smooths the measurements before applying gravity to the icons. Use the page's calibration control if the laptop's resting position needs to become the level position.

Press **Control-C** in the terminal to stop the helper. The page returns to ordinary downward gravity when fresh sensor data stops arriving.

## Check support

This command opens the motion devices for five seconds, reports whether fresh accelerometer samples arrived, then closes them.

```sh
npm run motion -- --probe
```

To compile the helper without opening the devices, run this command.

```sh
node scripts/motion.mjs --build-only
```

The helper uses an undocumented Apple HID report format. Support depends on the Mac model, macOS version and sensor permissions. Some systems require administrator access or additional macOS permission. The launcher never elevates itself. Review any permission failure before deciding how to grant access. Swift must already be available on the machine.

On November 2, 2026, the five-second probe on this M4 Pro MacBook Pro opened three motion devices and received 4,026 accelerometer reports under the normal user account. The owner then confirmed on the live site that icons move toward the lowered side for both left and right tilt. This verifies the live connection and physical direction on this Mac. Lid readings outside the supported 30–170 degree opening range are sent as unavailable so the page can use its fallback.

## Connection and cleanup

The helper listens only on `127.0.0.1:3918`. It accepts the exact live app origin and the two local development origins on port 3001. It sends accelerometer samples and the lid angle when available. The connection stays between the page and the same computer.

The helper changes existing reporting settings only when it can retain their previous values. It restores those settings on a normal exit or when interrupted. A force kill or system crash can prevent cleanup. Sensor settings whose initial values cannot be read are left alone.

The process limits connections, rejects unexpected origins and paths, and stops if fresh sensor reports disappear. Build products are stored in the app's ignored `.motion` directory. Start the helper manually for each session.
