'use server';

import { db } from '@/db';
import { analytics, uri } from '@/db/schema';
import { convertToURL } from '@/lib/url';
import { nanoid } from 'nanoid';
import whatwg from 'whatwg-url';
import { unstable_noStore as noStore } from 'next/cache';

type State = {
  msg?: string;
  error?: string;
  shortUrl?: string;
};

export const shortenURLFormAction = async (
  prevState: State,
  formData: FormData,
): Promise<State> => {
  const { url } = Object.fromEntries(formData);

  const parsedUrl = whatwg.parseURL(url.toString());
  const baseUrl = whatwg.parseURL(process.env.NEXT_BASE_URL);

  if (!parsedUrl || !baseUrl) return { error: 'Invalid URL' };

  if (parsedUrl.host == baseUrl.host) {
    return { error: 'Invalid URL' };
  }

  const newUrl = whatwg.serializeURL(parsedUrl, true);

  const existingUri = await db.query.uri.findFirst({
    where: (uri, { eq }) => eq(uri.mainUrl, newUrl),
  });

  if (existingUri) {
    return {
      msg: 'URL already shortened!',
      shortUrl: convertToURL({ shortUrlId: existingUri.shortUrlId }),
    };
  }

  try {
    const shortUrlId = nanoid(8);

    await db.insert(uri).values({
      shortUrlId: shortUrlId,
      mainUrl: newUrl,
    });

    return { shortUrl: convertToURL({ shortUrlId }) };
  } catch (error) {
    if (error instanceof Error) console.error(error.message);
    else console.error(error);

    throw new Error('Error occured while adding url into database');
  }
};

export const redirectToMainUrl = async (shortId: string) => {
  try {
    const existingUri = await db.query.uri.findFirst({
      where: (uri, { eq }) => eq(uri.shortUrlId, shortId),
    });

    if (!existingUri) return null;

    const { mainUrl, shortUrlId } = existingUri;

    await db.insert(analytics).values({
      uriId: shortUrlId,
    });

    return mainUrl;
  } catch (error) {
    if (error instanceof Error) console.error(error.message);
    else console.error(error);

    throw new Error('Error occured while handling redirect');
  }
};

export const getAllUrls = async () => {
  noStore();

  const allUrls = await db
    .select({ url: uri.shortUrlId, mainUrl: uri.mainUrl })
    .from(uri);

  return allUrls.map((el) => ({
    ...el,
    url: convertToURL({ shortUrlId: el.url }),
  }));
};
