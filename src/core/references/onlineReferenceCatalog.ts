import { logger } from '@/core/logger';

const CENTRAL_CATALOG_URL =
  'https://raw.githubusercontent.com/anqlproject/ReferenceCatalog/main/catalog.json';
const MAX_CATALOG_BYTES = 1024 * 1024;
const MAX_RESOURCE_BYTES = 5 * 1024 * 1024;

export interface OnlineReferenceRepository {
  id: string;
  name: string;
  description?: string;
  catalogUrl: string;
}

export interface OnlineReferenceResource {
  id: string;
  name: string;
  type: string;
  category?: string;
  description?: string;
  fileUrl: string;
  version?: string;
  size: number;
  sha256: string;
}

export interface OnlineReferenceLibrary {
  id: string;
  name?: string;
  description?: string;
  resources: OnlineReferenceResource[];
}

export interface DownloadedOnlineResource {
  id: string;
  type: 'constant' | 'formula';
  symbol?: string;
  value?: number | string;
  latex?: string;
  source_url?: string;
  license?: string;
}

interface CachedResult<T> {
  value: T;
  fromCache: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateRawGithubUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid catalog URL');
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'raw.githubusercontent.com' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.split('/')[1] !== 'anqlproject'
  ) {
    throw new Error('Catalog URLs must use the official ANQL GitHub organization');
  }
  return url.href;
}

function validateCentralCatalog(value: unknown): OnlineReferenceRepository[] {
  if (!isRecord(value) || !Array.isArray(value.repositories)) {
    throw new Error('Invalid central reference catalog');
  }

  return value.repositories.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.name !== 'string' ||
      !entry.id.trim() ||
      !entry.name.trim()
    ) {
      throw new Error('Invalid repository entry in central reference catalog');
    }
    return {
      id: entry.id,
      name: entry.name,
      description: typeof entry.description === 'string' ? entry.description : undefined,
      catalogUrl: validateRawGithubUrl(entry.catalogUrl),
    };
  });
}

function validateLibraryCatalog(value: unknown, repository: OnlineReferenceRepository): OnlineReferenceLibrary {
  if (!isRecord(value) || !Array.isArray(value.resources)) {
    throw new Error('Invalid library reference catalog');
  }
  if (isRecord(value.library) && typeof value.library.id === 'string' && value.library.id !== repository.id) {
    throw new Error('Library catalog ID does not match the selected repository');
  }

  const catalogUrl = new URL(repository.catalogUrl);
  const catalogPath = catalogUrl.pathname.split('/');
  const resources = value.resources.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.name !== 'string' ||
      typeof entry.type !== 'string' ||
      typeof entry.fileUrl !== 'string' ||
      !Number.isSafeInteger(entry.size) ||
      (entry.size as number) < 0 ||
      typeof entry.sha256 !== 'string' ||
      !/^[a-f\d]{64}$/i.test(entry.sha256)
    ) {
      throw new Error('Invalid resource entry in library reference catalog');
    }

    const fileUrl = new URL(entry.fileUrl, repository.catalogUrl);
    if (
      validateRawGithubUrl(fileUrl.href) !== fileUrl.href ||
      fileUrl.pathname.split('/')[1] !== catalogPath[1] ||
      fileUrl.pathname.split('/')[2] !== catalogPath[2]
    ) {
      throw new Error(`Resource URL is outside the selected repository: ${entry.id}`);
    }

    return {
      id: entry.id,
      name: entry.name,
      type: entry.type,
      category: typeof entry.category === 'string' ? entry.category : undefined,
      description: typeof entry.description === 'string' ? entry.description : undefined,
      fileUrl: fileUrl.href,
      version: typeof entry.version === 'string' ? entry.version : undefined,
      size: entry.size as number,
      sha256: entry.sha256,
    };
  });

  const library = isRecord(value.library) ? value.library : {};
  return {
    id: typeof library.id === 'string' ? library.id : repository.id,
    name: typeof library.name === 'string' ? library.name : repository.name,
    description: typeof library.description === 'string' ? library.description : repository.description,
    resources,
  };
}

function readCache<T>(key: string, validate: (value: unknown) => T): T | undefined {
  try {
    const cached = localStorage.getItem(key);
    if (cached === null) return undefined;
    return validate(JSON.parse(cached) as unknown);
  } catch (error) {
    logger.error('Failed to read cached online reference catalog', error as Error, { key });
    return undefined;
  }
}

function writeCache(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    logger.error('Failed to cache online reference catalog', error as Error, { key });
  }
}

async function fetchJson(url: string, maxBytes: number): Promise<unknown> {
  const response = await fetch(url, {
    cache: 'no-cache',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}`);

  const declaredSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    throw new Error('Catalog response exceeds the permitted size');
  }

  const bytes = await readResponseBytes(response, maxBytes, 'Catalog response');
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

async function readResponseBytes(response: Response, maxBytes: number, label: string): Promise<ArrayBuffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > maxBytes) throw new Error(`${label} exceeds the permitted size`);
    return bytes;
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalSize += value.byteLength;
    if (totalSize > maxBytes) {
      await reader.cancel();
      throw new Error(`${label} exceeds the permitted size`);
    }
    chunks.push(value);
  }

  const buffer = new ArrayBuffer(totalSize);
  const output = new Uint8Array(buffer);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

async function fetchCached<T>(
  url: string,
  cacheKey: string,
  maxBytes: number,
  validate: (value: unknown) => T,
): Promise<CachedResult<T>> {
  const cached = readCache(cacheKey, validate);
  try {
    const rawValue = await fetchJson(url, maxBytes);
    const value = validate(rawValue);
    writeCache(cacheKey, rawValue);
    return { value, fromCache: false };
  } catch (error) {
    if (cached !== undefined) return { value: cached, fromCache: true };
    throw error;
  }
}

export function fetchOnlineReferenceRepositories(): Promise<CachedResult<OnlineReferenceRepository[]>> {
  return fetchCached(
    CENTRAL_CATALOG_URL,
    'anql:online-reference-catalog',
    MAX_CATALOG_BYTES,
    validateCentralCatalog,
  );
}

export function fetchOnlineReferenceLibrary(
  repository: OnlineReferenceRepository,
): Promise<CachedResult<OnlineReferenceLibrary>> {
  const url = validateRawGithubUrl(repository.catalogUrl);
  return fetchCached(
    url,
    `anql:online-reference-library:${repository.id}:${url}`,
    MAX_CATALOG_BYTES,
    (value) => validateLibraryCatalog(value, repository),
  );
}

export async function downloadOnlineReferenceResource(
  resource: OnlineReferenceResource,
): Promise<DownloadedOnlineResource> {
  const response = await fetch(validateRawGithubUrl(resource.fileUrl), {
    cache: 'no-cache',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Resource request failed with HTTP ${response.status}`);

  const bytes = await readResponseBytes(response, MAX_RESOURCE_BYTES, 'Resource');
  if (bytes.byteLength !== resource.size) throw new Error('Resource size does not match its catalog entry');

  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  if (hash !== resource.sha256.toLowerCase()) {
    throw new Error('Resource checksum does not match its catalog entry');
  }

  const payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  if (!isRecord(payload)) throw new Error('Invalid reference resource data');
  if (payload.id !== resource.id || payload.type !== resource.type) {
    throw new Error('Resource identity does not match its catalog entry');
  }
  const provenance = {
    source_url: typeof payload.source === 'string' ? payload.source : undefined,
    license: typeof payload.license === 'string' ? payload.license : undefined,
  };

  if (resource.type === 'constant') {
    if (
      (typeof payload.value !== 'number' && typeof payload.value !== 'string') ||
      (typeof payload.value === 'string' && !payload.value.trim()) ||
      !Number.isFinite(Number(payload.value))
    ) {
      throw new Error('Constant resource must have a numeric value');
    }
    return {
      id: resource.id,
      type: 'constant',
      symbol: typeof payload.symbol === 'string' ? payload.symbol : undefined,
      value: payload.value,
      ...provenance,
    };
  }

  if (resource.type === 'formula') {
    if (typeof payload.latex !== 'string' || !payload.latex.trim()) {
      throw new Error('Formula resource must have a LaTeX expression');
    }
    return {
      id: resource.id,
      type: 'formula',
      latex: payload.latex,
      ...provenance,
    };
  }

  throw new Error(`Unsupported online reference type: ${resource.type}`);
}
