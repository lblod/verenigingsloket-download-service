import { app } from 'mu';
import {queryAssociations, queryAssociationsId, queryAssociationsLocations, queryAssociationsMembers } from './query';
import createSheet from './sheet';

app.get('/download', async function(req, res ) {
    const associationIds = (await queryAssociationsId(req.query)).map((el)=> (el.uuid));
    const [associations,locations,members] = await Promise.all([queryAssociations(associationIds), queryAssociationsLocations(associationIds), queryAssociationsMembers(associationIds)]);
    const file = await createSheet(associations,locations,members);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.download(file);
} );