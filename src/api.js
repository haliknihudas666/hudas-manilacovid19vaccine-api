const express = require('express');
const bodyParser = require("body-parser");
const cors = require('cors')

const app = express();
const PORT = process.env.PORT || 3002;

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.use(cors());
app.use(express.json())

const downloader = require('./controllers/getData')
app.use(downloader)


app.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`)
})