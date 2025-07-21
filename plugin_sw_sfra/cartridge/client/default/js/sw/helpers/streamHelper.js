/* eslint-disable no-restricted-globals */
const PLACEHOLDER_PREFIX = '$sw';
const LAST_BYTES_COUNT = 20; // Max placeholder length assumed

export const X_SF_CC_SITEID = 'x-sf-cc-siteid';
export const X_SF_CC_REQUESTLOCALE = 'x-sf-cc-requestlocale';

/**
 * Streams byte array to detect if any placeholders match at a specific index.
 * Evaluates each placeholder byte-by-byte. Non-matching candidates are excluded.
 * Returns the matched placeholder config with its start/end positions, or null.
 * @param {Uint8Array} bytes - The byte array to search.
 * @param {number} startIndex - The index to start scanning from.
 * @param {Uint8Array} prefixBytes - The byte representation of the '$sw' prefix.
 * @param {Array} placeholderConfigs - List of available placeholder configurations.
 * @returns {object|null} The matching placeholder config with position data, or null.
 */
function findMatchingPlaceholder(bytes, startIndex, prefixBytes, placeholderConfigs) {
    const len = bytes.length;
    let i = startIndex;
    let idx = 0;
    let allFinished = false;
    let found = false;
    let matchData = null;

    const candidates = placeholderConfigs.map(config => ({
        config,
        bytes: config.placeholderBytes,
        length: config.placeholderBytes.length,
        matched: config.placeholderBytes[0] === bytes[i],
        finished: config.placeholderBytes.length === 1
    }));

    i++;
    idx++;

    while (i < len && candidates.length && !allFinished && !found) {
        allFinished = true;

        for (let k = candidates.length - 1; k >= 0; k--) {
            const c = candidates[k];
            if (idx < c.length) {
                c.matched = c.matched && c.bytes[idx] === bytes[i];
            }
            if (idx === c.length - 1) {
                c.finished = true;
            }

            allFinished = allFinished && c.finished;
            found = found || (c.finished && c.matched);

            if (!c.matched) {
                candidates.splice(k, 1);
            }
        }

        i++;
        idx++;
    }

    if (found) {
        matchData = candidates[0];
        matchData.end = i - 1;
        matchData.start = matchData.end - matchData.length - prefixBytes.length + 1;
    }

    return matchData;
}

/**
 * Searches through a byte chunk for placeholders.
 *
 * If found, splits the chunk into:
 *   - before placeholder
 *   - after placeholder
 *   - leftover bytes to handle boundary cases
 *
 * Preserves last bytes if not final chunk to catch split placeholders.
 * @param {Uint8Array} bytes - Byte array to search through.
 * @param {Uint8Array} prefixBytes - Byte sequence of the placeholder prefix (e.g., '$sw').
 * @param {Array} placeholderConfigs - List of placeholder configurations with encoded byte values.
 * @param {boolean} isFinal - Whether this is the final chunk; affects handling of leftover bytes.
 * @returns {object} Object containing:
 *   - found (object|null),
 *   - before (Uint8Array|null),
 *   - after (Uint8Array|null),
 *   - leftover (Uint8Array|null).
 */
function extractPlaceholderChunk(bytes, prefixBytes, placeholderConfigs, isFinal) {
    const len = bytes.length;
    let pointer = 0;
    let prefixIdx = 0;
    let found = null;
    let before = bytes;
    let after = null;
    let leftover = null;

    while (pointer < len && !found) {
        while (
            bytes[pointer] === prefixBytes[prefixIdx] &&
            prefixIdx < prefixBytes.length &&
            pointer < len
            ) {
                prefixIdx++;
                pointer++;
            }

        if (prefixIdx === prefixBytes.length && pointer < len) {
            found = findMatchingPlaceholder(bytes, pointer, prefixBytes, placeholderConfigs);
        }

        prefixIdx = 0;
        pointer++;
    }

    if (found) {
        before = bytes.slice(0, found.start);
        after = bytes.slice(found.end + 1);
    } else if (!isFinal) {
        if (before.length > LAST_BYTES_COUNT) {
            leftover = before.slice(before.length - LAST_BYTES_COUNT);
            before = before.slice(0, before.length - LAST_BYTES_COUNT);
        } else {
            leftover = before;
            before = null;
        }
    }

    return { found, before, after, leftover };
}

/**
 * Encodes placeholders from config into byte sequences for stream matching.
 * @param {Array} cachedParts - The original placeholder configuration passed to the service worker.
 * @returns {object} An object containing:
 *   - `prefixBytes`: Byte representation of the placeholder prefix.
 *   - `configs `: Array of placeholder configurations with encoded byte values.
 */
function encodePlaceholderConfigs(cachedParts) {
    const encoder = new TextEncoder();
    const prefixBytes = encoder.encode(PLACEHOLDER_PREFIX);
    const configs = cachedParts.map(c => {
        if (!c.placeholder.startsWith(PLACEHOLDER_PREFIX)) {
            throw new Error(`Each placeholder must start with ${PLACEHOLDER_PREFIX}`);
        }

        return { ...c, placeholderBytes: encoder.encode(c.placeholder.slice(PLACEHOLDER_PREFIX.length)) };
    });

    return { prefixBytes, configs };
}

/**
 * Builds initialization headers and metadata from the original Response.
 * @param {Response} fromResponse - The original response object.
 * @returns {object} An object suitable for use with the `Response` constructor.
 */
function buildInitHeaders(fromResponse) {
    const init = {
        status: fromResponse.status,
        statusText: fromResponse.statusText,
        headers: { 'X-ServedByServiceWorker': 'true' }
    };
    fromResponse.headers.forEach((v, k) => (init.headers[k] = v));
    
    return init;
}

/**
 * Retrieves or fetches and caches a response fragment based on cache rules.
 * @param {object} partConfig - Configuration for the specific cacheable part.
 * @param {string} siteId - The current site identifier.
 * @param {string} locale - The current request locale.
 * @param {string} cacheId - The name of the cache storage to use.
 * @returns {object} An object containing `value`, a Uint8Array of the cached content.
 */
async function fetchOrCachePart(partConfig, siteId, locale, cacheId) {
    const key = `${siteId}.${locale}.${partConfig.cacheSuffix}`;
    let resp = await caches.match(key);

    if (!resp) {
        let url = partConfig.url
            .replace(`-${self.serverPreparedData.urlSiteId}-`, `-${siteId}-`)
            .replace(`/${self.serverPreparedData.urlLocale}/`, `/${locale}/`);

        resp = await fetch(new Request(url));
        if (resp && resp.ok) {
            const cache = await caches.open(cacheId);
            await cache.put(key, resp.clone());
        }
    }

    const data = new Uint8Array(await resp.arrayBuffer());
    
    return { value: data };
}

/**
 * Merges several Uint8Array chunks into a single array.
 * @param {...Uint8Array} arrays - The byte arrays to merge.
 * @returns {Uint8Array} A new Uint8Array containing all bytes from the input arrays.
 */
function combineUint8Arrays(...arrays) {
    let total = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;

    for (let arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }

    return result;
}

/**
 * Creates a streaming Response that replaces placeholders on-the-fly using cached or fetched parts.
 * Reads the base response as a stream and searches for configured placeholders.
 * When found, these placeholders are replaced on-the-fly using content fetched from cache (or network).
 * @param {Response} baseResponse - The original server response to process.
 * @param {Array} cachedParts - Configuration objects for placeholder replacements.
 * @param {string} cacheId - Cache storage name used to retrieve or store parts.
 * @returns {Response} A new Response instance with streaming content.
 */
export function createStream(baseResponse, cachedParts, cacheId) {
    const headersInit = buildInitHeaders(baseResponse);
    const siteId = headersInit.headers[X_SF_CC_SITEID];
    const locale = headersInit.headers[X_SF_CC_REQUESTLOCALE];

    const stream = new ReadableStream({
        async start(controller) {
            this.reader = baseResponse.body.getReader();
            const { prefixBytes, configs } = encodePlaceholderConfigs(cachedParts);
            this.prefixBytes = prefixBytes;
            this.configs = configs;
            this.queue = [this.readChunk()];
        },
        async readChunk() {
            const res = await this.reader.read();
            
            return { ...res, isBase: true };
        },
        async nextFromQueue() {
            let item = await this.queue.shift();
            while (item.merge && this.queue.length) {
                const next = await this.queue.shift();
                item.done = item.done || next.done;
                item.merge = next.merge;
                item.isBase = next.isBase;
                
                if (next.value) {
                    item.value = combineUint8Arrays(item.value || [], next.value);
                }
            }
            
            return item;
        },
        async pull(controller) {
            if (!this.queue.length || this.done) return controller.close();

            const { done, value, isBase } = await this.nextFromQueue();
            this.done = this.done || done;
            if (this.done && !value) return controller.close();

            const { found, before, after, leftover } = extractPlaceholderChunk(
                value, this.prefixBytes, this.configs, this.done
            );

            if (before) controller.enqueue(before);
            if (leftover) this.queue.unshift(Promise.resolve({ value: leftover, merge: true }));
            if (after) this.queue.unshift(Promise.resolve({ value: after, merge: false }));
            if (found) this.queue.unshift(fetchOrCachePart(found.config, siteId, locale, cacheId));
            if (!this.done && isBase) this.queue.push(this.readChunk());

            return this.pull(controller);
        },
        cancel() {
            this.done = true;
            this.queue = [];
        }
    });

    return new Response(stream, headersInit);
}
