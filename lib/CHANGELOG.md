# auto-adb

## 2.0.2

### Patch Changes

- include CHANGELOG.md in npm package

## 2.0.1

### Patch Changes

- update README

## 2.0.0

### Major Changes

- - Support shorthand cli flags `-c` and `-C`.
  - Support variable injection, instead of automatically inject device id into adb-like commands. It means you can use `echo @{deviceid}` to print device id and `scrcpy -s @{deviceid}` to open scrcpy for deviceid. It is flexible.

## 1.2.0

### Minor Changes

- Support running cleanup command for multiple connected Android devices

## 1.1.2

### Patch Changes

- update README

## 1.1.1

### Patch Changes

- update README

## 1.1.0

### Minor Changes

- change arg name

## 1.0.2

### Patch Changes

- should cleanup once in SIGNET handler

## 1.0.1

### Patch Changes

- fix typo on README

## 1.0.0

### Major Changes

- Make it public.

## 0.0.2

### Patch Changes

- update deps
