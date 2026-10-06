/**
 * Browser stand-in for `node:zlib` inside the just-bash bundle.
 * The published browser build still imports Node's zlib for gzip/gunzip/rg.
 * Curriculum checks do not need those commands. Calling them fails closed
 * instead of reaching Node or the network.
 */

function unavailable(name: string): never {
  throw new Error(`${name} is not available in the browser training sandbox`)
}

export function gzipSync(): never {
  unavailable('gzip')
}

export function gunzipSync(): never {
  unavailable('gunzip')
}

export const constants = {
  Z_NO_COMPRESSION: 0,
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_DEFAULT_COMPRESSION: -1,
}
