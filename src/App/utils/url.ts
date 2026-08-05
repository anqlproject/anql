/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { LinkType } from '@/editor/nodes/LinkNode/LinkNode';

const SUPPORTED_URL_PROTOCOLS = new Set([
  'http:',
  'https:',
  'mailto:',
  'sms:',
  'tel:',
]);

export function sanitizeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
     
    if (!SUPPORTED_URL_PROTOCOLS.has(parsedUrl.protocol)) {
      return 'about:blank';
    }
  } catch {
    return url;
  }
  return url;
}

// Source: https://stackoverflow.com/a/8234912/2013580
const urlRegExp = new RegExp(
  /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)/,
);
export function validateUrl(url: string): boolean {
  // TODO Fix UI for link insertion; it should never default to an invalid URL such as https://.
  // Maybe show a dialog where they user can type the URL before inserting it.
  return url === 'https://' || urlRegExp.test(url);
}


export function isWebLink(url: string): boolean {
  const webPatterns = [
    /^https?:\/\//i,
    /^www\./i,
    /\.(com|org|net|edu|gov|io|co|fr|uk|de|es|it|nl|be|ch|ca|au|jp|cn|ru|br|in|mx|kr|se|no|dk|fi|pl|pt|gr|tr|il|sa|ae|za|ng|ke|eg|za|ng)(\/|$)/i,
  ];
  return webPatterns.some(pattern => pattern.test(url));
}

export function extractLinkTypeFromUrl(url: string): LinkType {
  if (url.startsWith("@row:")) {
    return "row";
  } else if (url.startsWith("@node:")) {
    return "node";
  } else if (url.startsWith("@document:") || url.startsWith("@")) {
    return "document";
  } else if (isWebLink(url)) {
    return "external";
  }
  return "external";
}
