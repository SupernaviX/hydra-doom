import { EGameType, GameData } from "../types";

export const getArgs = ({ type, petName }: GameData) => {
  const args = ["-window", "-nogui", "-nomusic", "-config", "default.cfg"];

  args.push(
    "-iwad",
    "freedoom2.wad",
    "-merge",
    "dm_iog.wad",
    "iog_assets.wad",
    "-warp",
    "1",
    "-ticdup",
    "2",
    "-devparm",
  );
  if (type === EGameType.SOLO) {
    // Do nothing
    console.log("SOLO");
  } else {
    args.push("-altdeath", "-connect", "1");
  }

  if (petName) args.push("-pet", petName);

  return args;
};
