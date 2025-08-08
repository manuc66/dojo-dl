import { mkdirp } from "mkdirp";
import { DojoAPI, Item } from "./dojo-api";
import Path from "path";
import FS from "fs";
import fs from "fs";

const IMAGE_DIR = "../images";
function createDirectory(path: string): boolean {
  return mkdirp.sync(path) != null;
}

export async function processItemDownload(
  downloadFolder: string | null,
  dojoAPI: DojoAPI,
  item: Item,
  knownDate: Set<string>,
): Promise<void> {
  let directoryPath: string;

  if (downloadFolder == null) {
    directoryPath = Path.resolve(__dirname, IMAGE_DIR, item.date);
  } else if (!FS.existsSync(downloadFolder)) {
    directoryPath = Path.resolve(Path.resolve(__dirname, IMAGE_DIR), item.date);
    console.log(
      `Folder ${downloadFolder} does not exist, using this one instead: ${Path.resolve(
        __dirname,
        IMAGE_DIR,
      )}`,
    );
  } else {
    directoryPath = Path.resolve(downloadFolder, item.date);
  }

  if (!knownDate.has(item.date)) {
    if (createDirectory(directoryPath)) {
      console.log(`Directory created: ${directoryPath}`);
    }
    knownDate.add(item.date);
  }
  const filePath = Path.resolve(directoryPath, item.name);
  await downloadFileIfNotExists(dojoAPI, item.url, filePath);
}

async function downloadFileIfNotExists(
  dojoAPI: DojoAPI,
  url: string,
  filePath: string,
): Promise<void> {
  const exists = fileExists(filePath);
  if (!exists) {
    try {
      await dojoAPI.downloadFile(url, filePath);
    } catch (error) {
      console.error("Failed to download file ", url, error);
    }
  }
}

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
