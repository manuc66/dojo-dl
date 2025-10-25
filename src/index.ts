import { config } from "dotenv";
import { DojoAPI } from "./dojo-api";
import { processConcurrently } from "./throttling";
import { processItemDownload } from "./download";
import { Item } from "./item";
import { createInterface } from "node:readline";

config();

void (async () => {
  await main();
})();

async function main(): Promise<void> {
  const email = readEnv("DOJO_EMAIL");
  const password = readEnv("DOJO_PASSWORD");
  const downloadFolder = readEnv("DOWNLOAD_FOLDER");
  const dojoAPI = new DojoAPI();

  await dojoAPI.login(email, password, promptForCode);

  const knownDate = new Set<string>();

  const getItems = () => dojoAPI.getAllItems();
  const processItem = async (item: Item) =>
    await processItemDownload(downloadFolder, dojoAPI, item, knownDate);

  const maxConcurrentOp = 4;
  const totalItems: number = await processConcurrently(
    maxConcurrentOp,
    getItems,
    processItem,
  );

  console.log(`Total items: ${totalItems}`);
}

function readEnv(envName: string) {
  const envValue = process.env[envName];
  if (!envValue) {
    throw new Error(
      `Configuration missing for '${envName}', missing entry in the .env file.`,
    );
  } else {
    return envValue;
  }
}

async function promptForCode(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Please enter the one-time code sent to your email: ', (code) => {
      rl.close();
      resolve(code);
    });
  });
}
