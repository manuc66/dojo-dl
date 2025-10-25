import { FeedItemAttachments } from "./feed-item-attachments";

export interface FeedRessource {
  _links: { prev?: { href?: string } };
  _items: {
    time: string;
    contents: {
      attachments?: FeedItemAttachments[];
    };
  }[];
}