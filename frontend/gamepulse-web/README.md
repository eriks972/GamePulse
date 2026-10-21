# GamePulse

GamePulse is a full-stack sports analytics platform built to deliver team, player, schedule, standings, comparison, and analytics tools across multiple sports. The first live release focuses on NBA data and provides a complete basketball analytics experience powered by a Next.js frontend, an ASP.NET Core backend, processed historical datasets, Docker, Azure Container Apps, and Vercel.

## Live Demo

**Frontend:** `https://game-pulse-qk2uyz1ob-eriks972s-projects.vercel.app/`
**API:** `https://gamepulse-api.salmongrass-bfcb2172.eastus.azurecontainerapps.io`

## Project Overview

GamePulse started as an NBA analytics dashboard and is structured to grow into a multi-sport platform. The NBA section includes real historical data, team profiles, player profiles, standings, schedule results, game breakdowns, team comparisons, leaderboards, and interactive analytics charts.

The goal of the project is to create a sports data platform that goes beyond basic scores by giving users context, comparisons, rankings, and visual insights.

## Current Features

### NBA Dashboard

* League landing page for NBA coverage
* Season-aware navigation
* Quick links to teams, players, schedules, standings, comparisons, and analytics

### Teams

* All 30 NBA teams
* Search and filter by conference and division
* Season-based records
* Team detail pages
* Team stat cards for scoring, defense, rebounding, assists, and shooting

### Players

* Searchable NBA player index
* 4,000+ player records
* Active and inactive player status
* Player detail pages
* Player profile information including team, position, height, weight, school, country, draft information, jersey number, and career era

### Schedule & Game Details

* Historical NBA schedule results
* Game result cards
* Individual game detail pages
* Final score breakdowns
* Quarter-by-quarter line score data

### Standings

* Season-based standings
* League, conference, and division filtering
* Win/loss records
* Win percentage rankings

### Compare Teams

* Side-by-side team comparison
* Record, rank, conference, and division context
* Team stat comparisons including points per game, opponent points per game, rebounds, assists, and shooting efficiency

### Analytics

* Tabbed analytics dashboard
* Overview summary cards
* Team stat leaderboards
* Offensive rankings
* Defensive rankings
* Shooting efficiency rankings
* Ball control metrics
* Interactive charts built with Recharts

### Leagues Roadmap

* NBA live now
* Expansion roadmap for NFL, MLB, NHL, WNBA, college sports, soccer, combat sports, racing, tennis, golf, esports, and more

## Analytics Charts

The NBA analytics dashboard includes:

* Top teams by scoring margin
* Points per game vs assists per game scatter plot
* Opponent points per game defensive chart
* Ball control scatter plot
* Shooting efficiency grouped bar chart using FG%, 3PT%, and FT%

## Tech Stack

### Frontend

* Next.js
* TypeScript
* React
* Tailwind CSS
* Recharts
* Vercel

### Backend

* ASP.NET Core Web API
* C#
* Docker
* Azure Container Apps

### Data Processing

* Python
* pandas
* Kaggle NBA dataset
* Processed JSON data files served by the backend API

### Deployment

* Frontend deployed on Vercel
* Backend deployed on Azure Container Apps
* Docker image hosted on Docker Hub
* Frontend communicates with production API using environment variables

## Architecture

```text
GamePulse
├── Frontend
│   ├── Next.js
│   ├── TypeScript
│   ├── Tailwind CSS
│   └── Recharts
│
├── Backend
│   ├── ASP.NET Core Web API
│   ├── C#
│   ├── Docker
│   └── Azure Container Apps
│
└── Data
    ├── Raw Kaggle CSV files
    ├── Python processing scripts
    └── Processed JSON files
```

## API Overview

The backend follows a league-based API structure so the platform can expand beyond the NBA.

Example endpoints:

```text
/api/leagues/nba/teams
/api/leagues/nba/teams/{id}
/api/leagues/nba/players
/api/leagues/nba/players/{id}
/api/leagues/nba/games
/api/leagues/nba/games/{id}
/api/leagues/nba/standings
/api/leagues/nba/team-stats
/api/leagues/nba/seasons
```

## Environment Variables

The frontend uses an environment variable to connect to the deployed API.

```env
NEXT_PUBLIC_API_BASE_URL=https://gamepulse-api.salmongrass-bfcb2172.eastus.azurecontainerapps.io
```

For local development, this can point to the local ASP.NET Core API instead.

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5241
```

## Running the Frontend Locally

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Running the Backend Locally

From the ASP.NET Core API project:

```bash
dotnet run
```

The API runs locally at:

```text
http://localhost:5241
```

## Docker Backend Deployment

The backend is containerized using Docker.

Build the image:

```bash
docker buildx build \
  --platform linux/amd64 \
  -t your-dockerhub-username/gamepulse-api:latest \
  --push .
```

Deploy to Azure Container Apps using the pushed Docker image.

## Data Notes

GamePulse currently uses processed historical NBA data from a Kaggle dataset. The current version is not a live-score platform. Live sports data, real-time updates, and premium data integrations are planned for future versions.

## Current Limitations

* NBA is the only fully built league section right now
* Data is historical rather than live
* Some advanced player stat pages are planned for future development
* More sports will be added over time
* Real-time score tracking is not included in the MVP

## Roadmap

Planned future improvements include:

* Add player season statistics
* Add player leaderboards
* Add NFL, MLB, NHL, and WNBA sections
* Add advanced team trends
* Add more chart types
* Add live data integrations
* Add injury, roster, and transaction data
* Add user accounts and saved comparisons
* Add premium live-data features

## Why I Built This

GamePulse was built to combine full-stack engineering, sports analytics, data processing, and production deployment into one project. The goal was to create a real sports analytics platform that demonstrates frontend development, backend API design, data transformation, cloud deployment, and scalable product planning.

## Author

Built by Erik Swanson.
