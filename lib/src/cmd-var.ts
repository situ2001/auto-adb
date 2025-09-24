export const VAR_KEY_DEVICE_ID = 'deviceid';

export const replaceTemplateVars = (cmd: string, vars: Record<string, string>): string =>
  cmd.replace(/@\{([a-zA-Z0-9_]+)\}/g,
    (_, varName) => {
      return vars[varName] ?? `@{${varName}}`;
    }
  );

export const detectCommandHasVar = (cmd: string, varName: string): boolean => {
  const varPattern = new RegExp(`@\\{${varName}\\}`);
  return varPattern.test(cmd);
};
