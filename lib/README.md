# auto-adb

A CLI tool to automatically execute commands when Android devices connect through ADB.

## Why need this?

To reduce repetitive tasks when connecting Android devices to your computer.

> Imagine a scenario where you frequently connect your Android device to your computer for development or testing purposes. Each time you connect the device, you need to run a series of commands to set up the environment, such as configuring port forwarding, setting up proxies, or installing necessary apps. This can be tedious and time-consuming.

## Features

In short, this tool provides the following features:

- Automatically execute specified commands when devices connect
- Support for cleanup commands when the tool exits

## Installation

You can install `auto-adb` globally or use it via `npx`:

```shell
npm install -g auto-adb

# Or use via
npx auto-adb
pnpm dlx auto-adb
```

Then you can run with `--help` option to see usage.

## Examples

### Simple example

Print a message when device connects and when the program exits:

```shell
npx auto-adb -c "echo Device @{deviceid} connected" -C "echo Cleaning up for device @{deviceid}"
```

Open `scrcpy` for the connected device:

```shell
npx auto-adb -c "scrcpy -s @{deviceid}"
```

### For web developers

For example, here is a workflow for web developers who would like to do the following every time an Android device connects:
 
1. Reverse port `8080` from the Android device to the computer to access MITM server running on the computer.
2. Setup http proxy address to `127.0.0.1:8080` on the Android device to intercept HTTP(S) traffic.

And dev hope to run cleanup commands when the this CLI tool exits:

1. Remove the port reverse rule.
2. Clear the http proxy setting on the Android device.

Thus, the command would be:

```shell
npx auto-adb \
-c "adb -s @{deviceid} reverse tcp:8080 tcp:8080" \
-c "adb -s @{deviceid} shell settings put global http_proxy 127.0.0.1:8080" \
-C "adb -s @{deviceid} reverse --remove tcp:8080" \
-C "adb -s @{deviceid} shell settings put global http_proxy :0"
```

## Requirements

- Node.js 18 or higher
- ADB installed and added to your system's PATH

## TODOs

- [x] init repo
- [x] support use `deviceId` in user-specified command
- [ ] support read config from file
- [ ] more...
