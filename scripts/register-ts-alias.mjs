import { register } from "node:module";

/** Entry point for `node --import`. See ts-alias-hook.mjs. */
register("./ts-alias-hook.mjs", import.meta.url);
