import { holdersRouter } from "./routers/holders";
import { piecesRouter } from "./routers/pieces";

export const router = {
  pieces: piecesRouter,
  holders: holdersRouter,
};
