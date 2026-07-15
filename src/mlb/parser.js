/**
 * Parse raw MLB API game data into internal game objects.
 */

/**
 * Parse a single game from the MLB API response.
 * @param {Object} gameData - Raw game object from MLB API
 * @returns {Object} Parsed game object
 */
export function parseGame(gameData) {
  const status = getGameStatus(gameData);
  const homeScore = gameData.teams?.home?.score ?? null;
  const awayScore = gameData.teams?.away?.score ?? null;

  let winner = null;
  if (status === 'Final' && homeScore !== null && awayScore !== null) {
    winner = homeScore > awayScore
      ? gameData.teams.home.team.name
      : gameData.teams.away.team.name;
  }

  return {
    gameId: gameData.gamePk,
    gameDate: gameData.gameDate,
    homeTeam: gameData.teams.home.team.name,
    awayTeam: gameData.teams.away.team.name,
    homeTeamAbbreviation: gameData.teams.home.team.abbreviation || gameData.teams.home.team.name,
    awayTeamAbbreviation: gameData.teams.away.team.abbreviation || gameData.teams.away.team.name,
    homeScore,
    awayScore,
    status,
    winner,
    venue: gameData.venue?.name || 'Unknown',
  };
}

/**
 * Determine the game status from the API response.
 * @param {Object} gameData
 * @returns {string}
 */
function getGameStatus(gameData) {
  const statusCode = gameData.status?.detailedState || gameData.status?.codedGameState;

  switch (statusCode) {
    case 'Scheduled':
    case 'Pre-Game':
    case 'Preview':
      return 'Scheduled';
    case 'In Progress':
    case 'Live':
      return 'InProgress';
    case 'Final':
    case 'Game Over':
      return 'Final';
    case 'Postponed':
      return 'Postponed';
    case 'Cancelled':
      return 'Cancelled';
    default:
      return statusCode || 'Unknown';
  }
}

/**
 * Parse an array of raw game data objects.
 * @param {Array} gamesData
 * @returns {Array} Parsed game objects
 */
export function parseGames(gamesData) {
  return gamesData.map(parseGame);
}