import { config } from "dotenv";
import { DojoAPI, Item } from "./dojo-api";
import { processConcurrently } from "./throttling";
import { processItemDownload } from "./download";

config();

main();

async function main(): Promise<void> {
  const email = readEnv("DOJO_EMAIL");
  const password = readEnv("DOJO_PASSWORD");
  let dojoAPI = new DojoAPI();

  await dojoAPI.login(email, password);

  const knownDate = new Set<string>();

  const getItems = () => dojoAPI.getAllItems();
  const processItem = async (item: Item) =>
    await processItemDownload(dojoAPI, item, knownDate);

  const maxConcurrentOp = 4;
  const totalItems = await processConcurrently(
    maxConcurrentOp,
    getItems,
    processItem
  );

  console.log(`Total items: ${totalItems}`);
}

function readEnv(envName: string) {
  let envValue = process.env[envName];
  if (!envValue) {
    throw new Error(
      `Configuration missing for '${envName}', missing entry in the .env file.`
    );
  } else {
    return envValue;
  }
}
