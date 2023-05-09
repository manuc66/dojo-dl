import axios, { AxiosInstance } from "axios";
import moment from "moment";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import fs from "fs";

const FEED_URL = "https://home.classdojo.com/api/storyFeed?includePrivate=true";

export class DojoAPI {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = wrapper(
      axios.create({
        jar: new CookieJar(),
        withCredentials: true,
      })
    );
  }

  async login(email: string, password: string) {
    const LOGIN_URL = "https://home.classdojo.com/api/session";

    return await this.client.post(LOGIN_URL, {
      login: email,
      password: password,
      resumeAddClassFlow: false,
    });
  }

  async *getAllItems() {
    let feedUrl: string | null = FEED_URL;
    while (feedUrl != null) {
      let feed = await getFeedContent(this.client, feedUrl);
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

    const response = await this.client.get(url, {
      responseType: "stream",
    });

    response.data.pipe(writer);

    return new Promise<void>((resolve, reject) => {
      writer.on("finish", () => {
        console.log(`Download finished: ${filePath}`);
        resolve();
      });
      writer.on("error", () => {
        fs.rmSync(filePath);
        reject();
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
  date: string
): Generator<Item> {
  if (attachment.sources && attachment.sources.length > 0) {
    for (const source of attachment.sources) {
      yield { url: source.path, name: getResourceName(source.path), date };
    }
  }

  const url = attachment.path;
  const resourceName = getResourceName(url);
  const extIndex = resourceName.lastIndexOf(".");
  let fileName = attachment.metadata.filename;
  if (fileName && extIndex > 0) {
    const extRes = resourceName.substring(extIndex).toLowerCase();
    if (fileName.toLowerCase().endsWith(extRes)) {
      fileName = fileName.substring(0, fileName.length - extRes.length) + "_";
    }
  } else {
    fileName = "";
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
  url: string
): Promise<FeedRessource> {
  const storyFeed = await client.get(url);
  return storyFeed.data;
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
