import { mkdirp } from "mkdirp";
import { DojoAPI, Item } from "./dojo-api";
import Path from "path";
import fs from "fs";

const IMAGE_DIR = "../images";
function createDirectory(path: string): boolean {
  return mkdirp.sync(path) != null;
}

export async function processItemDownload(
  dojoAPI: DojoAPI,
  item: Item,
  knownDate: Set<string>
): Promise<void> {
  const directoryPath = Path.resolve(__dirname, IMAGE_DIR, item.date);
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
  filePath: string
): Promise<void> {
  const exists = fileExists(filePath);
  if (!exists) {
    try {
      await dojoAPI.downloadFile(url, filePath);
    } catch (error) {
      console.error("Failed to download file ", url);
    }
  }
}

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch (err) {
    return false;
  }
}
