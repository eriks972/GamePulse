import Link from "next/link";
import { getNbaTeams } from "@/lib/api";
import StandingsClient from "./standingsClient";
export default async function NbaStandingsPage() {
  const teams = await getNbaTeams();

  return <StandingsClient teams={teams} />; 
}