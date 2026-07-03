
const cron = require('node-cron');

const app = require('./src/app'); 
const { initAllCronJobs } = require('./src/cron');

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`USSD server running on port  ${PORT}`);

    
    initAllCronJobs();
});