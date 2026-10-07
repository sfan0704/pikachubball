const PINNED_NODE_MAJOR = 24;

/**
 * Stops the run with a clear message on an unsupported Node version. Newer
 * versions (25+) ship a built-in localStorage that hides the test DOM's own
 * and makes browser-hook tests fail for reasons unrelated to the code.
 */
export default function checkNodeVersion(): void {
  const major = Number(process.versions.node.split('.')[0]);
  if (major !== PINNED_NODE_MAJOR) {
    throw new Error(
      `Tests run on Node ${PINNED_NODE_MAJOR} (see .nvmrc); this is Node ${process.versions.node}. ` +
        `Switch with \`nvm use\` or put Node ${PINNED_NODE_MAJOR} first on PATH.`,
    );
  }
}
