import { Logger } from "@common";

const RESOURCE_NAME = GetCurrentResourceName();

async function getLatestVersion(): Promise<string> {
  const response = await fetch(
    "https://api.github.com/repos/nonefivem/no-cloud-cfx/releases/latest"
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch latest version: ${response.statusText}`);
  }

  const data = (await response.json()) as { tag_name: string };

  return data.tag_name;
}

function compareVersions(current: string, latest: string): number {
  // Remove 'v' prefix if present
  const currentClean = current.replace(/^v/, "");
  const latestClean = latest.replace(/^v/, "");

  const currentParts = currentClean.split(".").map(Number);
  const latestParts = latestClean.split(".").map(Number);

  const maxLength = Math.max(currentParts.length, latestParts.length);

  for (let i = 0; i < maxLength; i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;

    if (currentPart < latestPart) return -1;
    if (currentPart > latestPart) return 1;
  }

  return 0;
}

export async function checkForUpdatesAndLog(): Promise<void> {
  try {
    const currentVersion = GetResourceMetadata(RESOURCE_NAME, "version", 0);

    if (!currentVersion) {
      return Logger.warn(
        "VersionChecker",
        `Could not determine current version from resource metadata`
      );
    }

    const latestVersion = await getLatestVersion();
    const comparison = compareVersions(currentVersion, latestVersion);

    if (comparison < 0) {
      console.log(
        `A new version is available! Current: ${currentVersion}, Latest: ${latestVersion}`
      );
      console.log(
        `Download the latest version at: https://github.com/nonefivem/no-cloud-cfx/releases/latest`
      );
    } else if (comparison === 0) {
      Logger.info(
        "VersionChecker",
        `You are running the latest version (${currentVersion})`
      );
    }
  } catch (error) {
    Logger.error("VersionChecker", `Failed to check for updates: ${error}`);
  }
}
