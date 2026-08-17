const { execFileSync } = require('node:child_process');
const { join } = require('node:path');

// electron-builder skips code signing entirely with identity: null (no paid
// Apple Developer account). A completely unsigned .app, once macOS marks it
// quarantined (any browser download does this), gets Gatekeeper's "app is
// damaged and can't be opened" dialog on recent macOS - not the milder
// "unidentified developer" prompt right-click-Open can bypass. An ad-hoc
// signature (self-signed, no Apple-issued identity, still free) is enough to
// downgrade that back to the recoverable prompt.
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath]);
};
