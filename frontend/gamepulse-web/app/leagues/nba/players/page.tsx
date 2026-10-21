import { getNbaPlayers } from "@/lib/api";
import PlayersClient from "./playersClient";

export default async function NbaPlayersPage() {
  const players = await getNbaPlayers();

  return <PlayersClient players={players} />;
}
