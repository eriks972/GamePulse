const base=(process.env.NEXT_PUBLIC_API_BASE_URL||"http://localhost:5241").replace(/\/$/,"");
export class NhlApiError extends Error{constructor(public status:number){super(`NHL request failed (${status})`);}}
export async function nhl<T>(path:string,q:Record<string,string|undefined>={}):Promise<T>{const p=new URLSearchParams();for(const[k,v]of Object.entries(q))if(v)p.set(k,v);const r=await fetch(`${base}/api/leagues/nhl/${path}?${p}`,{cache:"no-store",signal:AbortSignal.timeout(60000)});if(!r.ok)throw new NhlApiError(r.status);return r.json();}
export const href=(path="",q:Record<string,string|undefined>={})=>{const p=new URLSearchParams();for(const[k,v]of Object.entries(q))if(v)p.set(k,v);return `/leagues/nhl${path?`/${path}`:""}${p.size?`?${p}`:""}`;};
export type Entity={id:string;name:string|null;abbreviation?:string|null;position?:string|null;teamIds:string[];gameIds:string[]};
export type Game={id:string;season:number;seasonType:string;date:string;homeTeamId:string;awayTeamId:string;homeScore:number|null;awayScore:number|null;status:string;completed:boolean;finish:string;venue:string|null;scoringComplete:boolean};
export type Stat={gameId:string;teamId:string;playerId:string|null;group:string;statistics:Record<string,number|null>};
export type Summary={id:string;name:string;group:string;teamIds:string[];games:number;observationRows:number;totals:Record<string,number|null>;rates:Record<string,number|null>;observedRows:Record<string,number>};
export type Coverage={season:number;scheduleGames:number;completedGames:number;teamBoxGames:number;playerBoxGames:number;missingTeamGames:number;missingPlayerGames:number;unknownFinishes:number;excludedBackupRows:number;reviewItems:number;issueCounts:Record<string,number>;note:string};
export type RecordRow={label:string;scheduledGames:number;completedGames:number;scoredGames:number;wins:number;regulationLosses:number;overtimeLosses:number;unknownResults:number;regulationWins:number|null;regulationOvertimeWins:number|null;points:number|null;pointsPercentage:number|null;goalsFor:number|null;goalsAgainst:number|null;goalDifferential:number|null;goalsPerGame:number|null};
export type TeamAnalytics={team:Entity;season:number;seasonType:string;record:RecordRow;statistics:Summary|null;missingBoxGames:number;homeAway:RecordRow[];months:RecordRow[]};
export type Profile={season:number;seasonType:string;player:Entity;teams:Entity[];teamId:string|null;skater:Summary|null;goalie:Summary|null;contributions:{teamId:string;skater:Summary|null;goalie:Summary|null}[];coverage:Coverage;method:string};
export type Page<T>={items:T[];total:number;page:number;pageSize:number};
export type Query=Record<string,string|string[]|undefined>;
export const value=(q:Query,k:string)=>typeof q[k]==="string"?q[k] as string:"";
export const label=(season:string|number)=>`${Number(season)-1}–${String(season).slice(-2)}`;
export const entity=(type:"teams"|"players"|"game",id:string)=>`${type}/${encodeURIComponent(id)}`;
