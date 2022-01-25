const { query, validationResult } = require('express-validator');
const axios = require('axios').default;
const express = require('express')
const router = express.Router()
const Zip = require('node-zip');
const chalk = require('chalk');
const download = require('download');

router.get(
    "/api/getdata",
    query('mobile_number').notEmpty(),
    query('first_name').notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).send({ 'error': errors.array() });
        }

        try {
            const login = await axios({
                method: 'get',
                url: `https://www.manilacovid19vaccine.ph/search-otp-ajax.php?MobileNo=${req.query.mobile_number}&FirstName=${req.query.first_name}`,
            })

            var registrationID = login.data.split('!')[1]
            var referenceID = login.data.split('!')[2]

            var dataZipped = await getData(registrationID, referenceID)
            if (dataZipped) {
                return res.setHeader('content-type', 'application/zip').send(dataZipped);
            } else {
                return res.status(404).send({ message: 'User not found.' });
            }
        } catch (err) {
            return res.status(500).send({ message: 'Something went wrong', error: err });
        }
    });

async function getData(registrationID, referenceID) {
    const zip = new Zip;
    var options = { base64: false, compression: 'DEFLATE' };

    const verify = await axios({
        method: 'get',
        url: `https://www.manilacovid19vaccine.ph/search-registration-ajax.php?RegistrationID=${registrationID}&ReferenceID=${referenceID}`,
        withCredentials: true,
    })

    var getCert
    try {
        getCert = await axios({
            method: 'get',
            url: `https://www.manilacovid19vaccine.ph/my-passport-certificate-print.php?RegistrationID=${registrationID}&ReferenceID=${referenceID}`,
            withCredentials: true,
            headers: {
                crossDomain: true,
                cookie: verify.headers['set-cookie']
            },
        })
    } catch (error) {
        return error.response.status
    }

    if (!getCert.data.includes('<script>')) {
        zip.file(`documents/${referenceID}/waiver.pdf`, await download(`https://www.manilacovid19vaccine.ph/waiver.php?RegistrationID=${registrationID}&ReferenceID=${referenceID}`));
        console.log(chalk.green('DOWNLOADED Waiver OF ' + referenceID))

        zip.file(`documents/${referenceID}/passport-vaccination-id.pdf`, await download(`https://www.manilacovid19vaccine.ph/my-passport-vaccination-id.php?RegistrationID=${registrationID}&ReferenceID=${referenceID}`, '', {
            headers: {
                cookie: verify.headers['set-cookie']
            }
        }));
        console.log(chalk.green('DOWNLOADED Vaccination ID OF ' + referenceID))

        zip.file(`documents/${referenceID}/passport-vaccination-id-back.pdf`, await download(`https://www.manilacovid19vaccine.ph/my-passport-vaccination-id-back.php?RegistrationID=${registrationID}&ReferenceID=${referenceID}`, '', {
            headers: {
                cookie: verify.headers['set-cookie']
            }
        }));
        console.log(chalk.green('DOWNLOADED Vaccination ID Back OF ' + referenceID))

        zip.file(`documents/${referenceID}/vaccination-certificate.pdf`, await download(`https://www.manilacovid19vaccine.ph/my-passport-certificate-print.php?RegistrationID=${registrationID}&ReferenceID=${referenceID}`, '', {
            headers: {
                cookie: verify.headers['set-cookie']
            }
        }));
        console.log(chalk.green('DOWNLOADED Vaccination Certificate OF ' + referenceID + '\n'))

        const getFamily = await axios({
            method: 'get',
            url: `https://manilacovid19vaccine.ph/my-passport-family.php`,
            withCredentials: true,
            headers: {
                crossDomain: true,
                cookie: verify.headers['set-cookie']
            },
        })

        var familyMembers = [];
        getFamily.data.match(/href="my-passport-family-members([^"]*)"/g).forEach(element => {
            familyMembers.push('https://manilacovid19vaccine.ph/' + element.replace('href=', '').replace('"', '').replace('"', ''))
        });

        for (const element of familyMembers) {
            var famReferenceID = element.split('?')[1].split('&')[1].replace('ReferenceID=', '');
            if (famReferenceID != referenceID) {
                var fileName;

                if (element.includes('my-passport-family-members-waiver-registration.php')) {
                    fileName = 'waiver'
                } else if (element.includes('my-passport-family-members-vaccination-id.php')) {
                    fileName = 'vaccination-id'
                } else if (element.includes('my-passport-family-members-vaccination-id-back.php')) {
                    fileName = 'vaccination-id-back'
                } else if (element.includes('my-passport-family-members-vaccination-certificate.php')) {
                    fileName = 'vaccination-certificate'
                }

                zip.file(`documents/${referenceID}/family/${famReferenceID}/${fileName}.pdf`, await download(element, '', {
                    headers: {
                        cookie: verify.headers['set-cookie']
                    }
                }));

                console.log(chalk.green(`DOWNLOADED FAMILY ${fileName} OF ${famReferenceID}`))
            }
        }

        return zip.generate(options)
    }

    return false
}


module.exports = router;
