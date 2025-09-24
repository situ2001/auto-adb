export const VAR_KEY_DEVICE_ID = 'deviceid';

export const replaceTemplateVars = (cmd: string, vars: Record<string, string>): string =>
  cmd.replace(/@\{__([a-zA-Z0-9_]+)__\}/g,
    (_, varName) => {
      return vars[varName] ?? `@{__${varName}__}`;
    }
  );

export const detectCommandHasVar = (cmd: string, varName: string): boolean => {
  const varPattern = new RegExp(`@\\{__${varName}__\\}`);
  return varPattern.test(cmd);
};
