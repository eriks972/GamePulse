import Link from "next/link";
import { getNbaTeams } from "@/lib/api";
import TeamsClient from "./teamClient";

export default async function NbaTeamsPage() {
  const teams = await getNbaTeams();

  return <TeamsClient teams={teams} />;
}