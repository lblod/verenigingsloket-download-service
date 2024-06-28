import { app } from 'mu'
import {
  queryAssociations,
  queryLocations,
  queryRepresentatives
} from './query'
import createSheet from './sheet'
import bodyParser from 'body-parser'
app.use(bodyParser.json())

app.put('/download', async function (req, res) {
  const associationIds = req.headers['association-ids']
  if (!associationIds) {
    return res.status(400).send('Associations not found or empty.')
  }
  const associations = await queryAssociations(associationIds)
  const locations = await queryLocations(associationIds)
  const representatives = await queryRepresentatives(associationIds)
  if (!associations || associations.length === 0) {
    return res.status(400).send('Associations not found or empty.')
  }
  const file = await createSheet(associations, locations, representatives)
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  res.download(file)
})
