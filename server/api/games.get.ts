import { games } from '../../app/games/index'

export default defineEventHandler(() => games.map(({ generate, score, weight, isCorrect, ...rest }) => rest))
