const base=(process.env.NEXT_PUBLIC_API_BASE_URL||"http://localhost:5241").replace(/\/$/,"");
export type MlbGroup={id:string|null;name:string|null};
export type MlbTeam={id:string;sourceId:string;season:number;name:string|null;abbreviation:string|null;league:MlbGroup|null;division:MlbGroup|null;venue:MlbGroup|null};
export type MlbPlayer={id:string;sourceId:string;season:number;fullName:string|null;position:string|null;batSide:string|null;pitchHand:string|null;teamIds:string[];rosterSnapshotTeamIds:string[];gameIds:string[]};
export type MlbGame={id:string;sourceId:string;season:number;seasonType:string;gameType:string|null;officialDate:string;gameDate:string|null;completed:boolean;status:string|null;homeTeamId:string;awayTeamId:string;homeTeamName:string|null;awayTeamName:string|null;homeScore:number|null;awayScore:number|null;gameNumber:number|null;doubleHeader:string|null;coverage:{teamGroupRows:number;playerGroupRows:number;inningRows:number}};
export type MlbStat={gameId:string;teamId:string;playerId?:string;playerName?:string|null;group:string;source:string|null;statistics:Record<string,number|string|null>};
export type MlbInning={gameId:string;teamId:string;inning:number;runs:number|null;hits:number|null;errors:number|null;source:string|null};
export type MlbStatistics={game:MlbGame;teamStatistics:MlbStat[];playerStatistics:MlbStat[];lineScores:MlbInning[]};
export type MlbPage<T>={items:T[];total:number;page:number;pageSize:number};
export type MlbCoverage={season:number;scheduleGames:number;completedGames:number;boxscoreGames:number;linescoreGames:number;missingBoxscoreGames:number;missingLinescoreGames:number;teamStatRows:number;playerStatRows:number;fileCoverageComplete:boolean;issueCounts:Record<string,number>;status:string};
export type MlbStanding={team:MlbTeam;scheduledGames:number;completedGames:number;games:number;excludedCompletedGames:number;wins:number;losses:number;ties:number;winPercentage:number|null;runsFor:number;runsAgainst:number};
export type MlbStandings={season:number;method:string;teams:MlbStanding[];providerSnapshot:{teamId:string;wins:number|null;losses:number|null;winningPercentage:string|null;gamesBack:string|null;divisionRank:string|null}[]};
export class MlbApiError extends Error {constructor(public status:number){super(`MLB request failed (${status})`);}}
export async function mlb<T>(path:string,query:Record<string,string|undefined>={}):Promise<T>{
 const params=new URLSearchParams();for(const [k,v]of Object.entries(query))if(v)params.set(k,v);
 const response=await fetch(`${base}/api/leagues/mlb/${path}?${params}`,{cache:"no-store",signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new MlbApiError(response.status);return response.json() as Promise<T>;
}
export const mlbHref=(path="",query:Record<string,string|undefined>={})=>{const p=new URLSearchParams();for(const[k,v]of Object.entries(query))if(v)p.set(k,v);return `/leagues/mlb${path?`/${path}`:""}${p.size?`?${p}`:""}`;};
export const entity=(kind:"teams"|"players"|"game",id:string)=>`${kind}/${encodeURIComponent(id)}`;
export const display=(value:number|string|null|undefined)=>value==null?"—":typeof value==="number"?new Intl.NumberFormat("en-US",{maximumFractionDigits:3}).format(value):value;
export function gameDate(date:string){const value=new Date(`${date}T12:00:00Z`);return Number.isNaN(value.getTime())?"Date unavailable":new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(value);}

export type MlbSeasonSummary={kind:string;id:string;seasonType:string;teamId:string|null;teamIds:string[];games:number;observationRows:number;totals:Record<string,number|null>;rates:Record<string,number|null>;observedRows:Record<string,number>;inningsPitched?:string|null};
export type MlbPlayerProfile={season:number;seasonType:string;player:MlbPlayer;selectedTeam:MlbTeam|null;batting:MlbSeasonSummary|null;pitching:MlbSeasonSummary|null;battingTeams:MlbSeasonSummary[];pitchingTeams:MlbSeasonSummary[];teams:MlbTeam[];coverage:MlbCoverage;method:string};
export type MlbScoreSplit={label:string;scheduledGames:number;completedGames:number;scoredGames:number;wins:number;losses:number;ties:number;winPercentage:number|null;runsFor:number|null;runsAgainst:number|null;runDifferential:number|null;runsPerGame:number|null;missingScoreGames:number};
export type MlbTeamAnalytics={season:number;seasonType:string;team:MlbTeam;record:MlbScoreSplit;homeAway:MlbScoreSplit[];months:MlbScoreSplit[];batting:MlbSeasonSummary|null;pitching:MlbSeasonSummary|null;missingBattingGames:number;missingPitchingGames:number;method:string};
export type MlbAnalytics={season:number;seasonType:string;method:string;coverage:MlbCoverage;teams:MlbTeamAnalytics[]};
export type MlbComparison={group:string;seasonType:string;left:MlbPlayerProfile;right:MlbPlayerProfile;differences:Record<string,number|null>;method:string};
export type MlbPlayerLog={season:number;seasonType:string;player:MlbPlayer;results:MlbPage<{game:MlbGame;statistics:MlbStat[]}>};
