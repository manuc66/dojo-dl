import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import moment from "moment";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import * as Stream from "node:stream";
import { createInterface } from 'node:readline';

interface ErrorResponse {
  error: {
    type?: number; // 401 in this case
    message?: string; // 'Unauthenticated'
    detail?: string; // 'Must enter a one time code to log in'
    code?: string; // 'ERR_MUST_USE_OTC_USER_OPTED_IN'
    fallbackMessage?: string; // "ClassDojo wants to keep your account safe. We've sent a one-time login code to your@account.tld."
    expected?: boolean; // true
  };
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

const FEED_URL = "https://home.classdojo.com/api/storyFeed?includePrivate=true";

export class DojoAPI {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = wrapper(
      axios.create({
        jar: new CookieJar(),
        withCredentials: true,
      }),
    );
  }

  async login(email: string, password: string): Promise<void> {
    const LOGIN_URL = "https://home.classdojo.com/api/session";

    const loginPayload: { login: string; password: string; resumeAddClassFlow: boolean; code?: string } = {
      login: email,
      password: password,
      resumeAddClassFlow: false,
    };

    let attempt = 0;
    while (attempt < 3) {
      try {
        // Attempt to log in without a code first
        return await this.client.post(LOGIN_URL, loginPayload);
      } catch (error) {
        if (error instanceof AxiosError && error.response && error.response.status === 401) {
          console.error('Unauthorized: Invalid credentials');

          // Access the error payload
          const structuredResponse = error.response.data as ErrorResponse;

          if (structuredResponse.error.type === 401 && 
              (structuredResponse.error.code === "ERR_MUST_USE_OTC_USER_OPTED_IN" || 
               structuredResponse.error.code === "ERR_MUST_USE_OTC_ANOMALOUS_LOGIN")) {
            console.log(structuredResponse.error.fallbackMessage);

            // Prompt for the one-time code
            loginPayload.code = await promptForCode(); // Add the code to the payload for the next attempt
          } else {
            // Handle other 401 errors or throw an error
            throw new Error('Unauthorized access. Please check your credentials.');
          }
        } else {
          // Handle other errors
          console.error('An error occurred:', error);
          throw error; // Re-throw the error for further handling
        }
      }
      attempt++;
    }
  }

  async *getAllItems() {
    let feedUrl: string | null = FEED_URL;
    while (feedUrl != null) {
      const feed = await getFeedContent(this.client, feedUrl);
      yield* getFeedItems(feed);
      if (feed._links && feed._links.prev && feed._links.prev.href) {
        feedUrl = feed._links.prev.href;
      } else {
        feedUrl = null;
      }
    }
  }

  async downloadFile(url: string, filePath: string) {
    const writer = fs.createWriteStream(filePath);

    const response: AxiosResponse<Stream> = await this.client.get(url, {
      responseType: "stream",
    });

    response.data.pipe(writer);

    return new Promise<void>((resolve, reject) => {
      writer.on("finish", () => {
        console.log(`Download finished: ${filePath}`);
        resolve();
      });
      writer.on("error", (err: Error) => {
        fs.rmSync(filePath);
        reject(err);
      });
    });
  }
}

export interface Item {
  url: string;
  name: string;
  date: string;
}

function* getItem(
  attachment: FeedItemAttachments,
  date: string,
): Generator<Item> {
  if (attachment.sources && attachment.sources.length > 0) {
    for (const source of attachment.sources) {
      yield { url: source.path, name: getResourceName(source.path), date };
    }
  }

  const url = attachment.path;
  const resourceName = getResourceName(url);

  const extIndex = resourceName.lastIndexOf(".");
  let fileName!: string;
  if (!attachment.metadata) {
    fileName = "";
  } else {
    fileName = attachment.metadata.filename;
    if (fileName && extIndex > 0) {
      const extRes = resourceName.substring(extIndex).toLowerCase();
      if (fileName.toLowerCase().endsWith(extRes)) {
        fileName = fileName.substring(0, fileName.length - extRes.length) + "_";
      }
    } else {
      fileName = "";
    }
  }

  if (fileName.trim().length === 0) {
    fileName = `file-${uuidv4()}`;
  }

  const filename = fileName + resourceName;

  yield { url, name: filename, date };
}

function* getFeedItems(feed: FeedRessource): Generator<Item> {
  for (const item of feed._items) {
    const date = moment(item.time).format("YYYY-MM-DD");
    const attachments = item?.contents?.attachments || [];

    for (const attachment of attachments) {
      yield* getItem(attachment, date);
    }
  }
}

async function getFeedContent(
  client: AxiosInstance,
  url: string,
): Promise<FeedRessource> {
  const storyFeed = await client.get(url);
  return storyFeed.data as FeedRessource;
}

function getResourceName(url: string) {
  return url.substring(url.lastIndexOf("/") + 1);
}

interface FeedItemAttachments {
  sources?: { path: string }[];
  ressourceName: string;
  path: string;
  metadata: { filename: string };
}

export interface FeedRessource {
  _links: { prev?: { href?: string } };
  _items: {
    time: string;
    contents: {
      attachments?: FeedItemAttachments[];
    };
  }[];
}
