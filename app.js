import { app } from 'mu'
import { queryAssociations } from './query'
import createSheet from './sheet'

app.get('/download', async function (req, res) {
  const associations = await queryAssociations(req.query)
  const file = await createSheet(associations)
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  res.download(file)
})
