import { handle } from '../server/handler.js'

export default function handler(req, res) {
  return handle(req, res, 'data')
}
