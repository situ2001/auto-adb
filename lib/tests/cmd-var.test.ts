import { describe, test, expect } from 'vitest';
import { VAR_KEY_DEVICE_ID, replaceTemplateVars, detectCommandHasVar } from '../src/cmd-var.js';

describe('replaceTemplateVars', () => {
	test('replaces deviceid placeholder in cmd', () => {
	const cmd = 'adb -s @{deviceid} reverse tcp:8080 tcp:8080';
	const result = replaceTemplateVars(cmd, { [VAR_KEY_DEVICE_ID]: 'emulator-5554' });
	expect(result).toBe('adb -s emulator-5554 reverse tcp:8080 tcp:8080');
	});

	test('replaces multiple occurrences of deviceid placeholder', () => {
	const cmd = '@{deviceid} copy and @{deviceid} paste';
	const result = replaceTemplateVars(cmd, { [VAR_KEY_DEVICE_ID]: 'device123' });
	expect(result).toBe('device123 copy and device123 paste');
	});

	test('leaves unknown placeholders unchanged', () => {
	const cmd = 'echo @{unknown}';
	const result = replaceTemplateVars(cmd, { [VAR_KEY_DEVICE_ID]: 'emulator' });
	expect(result).toBe('echo @{unknown}');
	});

	test('replaces proxy set command', () => {
	const cmd = 'adb -s @{deviceid} shell settings put global http_proxy 127.0.0.1:8080';
	const result = replaceTemplateVars(cmd, { [VAR_KEY_DEVICE_ID]: 'device-xyz' });
	expect(result).toBe('adb -s device-xyz shell settings put global http_proxy 127.0.0.1:8080');
	});

	test('replaces cleaning reverse remove command', () => {
	const cmd = 'adb -s @{deviceid} reverse --remove tcp:8080';
	const result = replaceTemplateVars(cmd, { [VAR_KEY_DEVICE_ID]: 'dev-001' });
	expect(result).toBe('adb -s dev-001 reverse --remove tcp:8080');
	});

	test('replaces cleaning proxy reset command', () => {
	const cmd = 'adb -s @{deviceid} shell settings put global http_proxy :0';
	const result = replaceTemplateVars(cmd, { [VAR_KEY_DEVICE_ID]: 'dev-001' });
	expect(result).toBe('adb -s dev-001 shell settings put global http_proxy :0');
	});
});

describe('detectCommandHasVar', () => {
	test('detects deviceid placeholder present', () => {
	const cmd = 'adb -s @{deviceid} shell';
	expect(detectCommandHasVar(cmd, VAR_KEY_DEVICE_ID)).toBe(true);
	});

	test('returns false when placeholder is absent', () => {
	const cmd = 'adb shell';
	expect(detectCommandHasVar(cmd, VAR_KEY_DEVICE_ID)).toBe(false);
	});

	test('detects other placeholders correctly', () => {
	const cmd = 'run @{foo}';
	expect(detectCommandHasVar(cmd, 'foo')).toBe(true);
	expect(detectCommandHasVar(cmd, 'bar')).toBe(false);
	});
});
