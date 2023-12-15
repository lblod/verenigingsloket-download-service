import { app } from 'mu';
import {queryAssociations, queryAssociationsLocations, queryAssociationsMembers } from './query';
import createSheet from './sheet';

app.use(cors({
    origin: 'http://localhost:4200', 
    methods: 'GET', 
  }));

app.get('/download', async function(_req, res ) {
    const [associations,locations,members] = await Promise.all([queryAssociations(), queryAssociationsLocations(), queryAssociationsMembers()]);
    const file = await createSheet(associations,locations,members);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.download(file);
} );