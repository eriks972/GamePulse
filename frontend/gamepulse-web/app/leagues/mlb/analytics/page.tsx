import {MlbView,type Query} from "../Views";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<Query>}){return <MlbView view="analytics" query={await searchParams}/>;}
