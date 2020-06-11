/* eslint-disable promise/no-nesting */
/* eslint-disable promise/always-return */
const functions = require('firebase-functions')
const admin = require('firebase-admin')
const cors = require('cors')({ origin: true })
const webpush = require('web-push')
const fs = require('fs')
const UUID = require('uuid-v4')
const os = require('os')
const Busboy = require('busboy')
const path = require('path')

var serviceAccount = require('./pwa-max-6421b-firebase.json')

var gcconfig = {
  projectId: 'pwa-max-6421b',
  keyFilename: 'pwa-max-6421b-firebase.json'
}

var gcs = require('@google-cloud/storage')(gcconfig)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://pwa-max-6421b.firebaseio.com/'
})

exports.storePostData = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    var uuid = UUID()

    const busboy = new Busboy({ headers: request.headers })
    // These objects will store the values (file + fields) extracted from busboy
    let upload
    const fields = {}

    // This callback will be invoked for each file uploaded
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      console.log(
        `File [${fieldname}] filename: ${filename}, encoding: ${encoding}, mimetype: ${mimetype}`
      )
      const filepath = path.join(os.tmpdir(), filename)
      upload = { file: filepath, type: mimetype }
      file.pipe(fs.createWriteStream(filepath))
    })

    // This will invoked on every field detected
    busboy.on('field', (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
      fields[fieldname] = val
    })

    // This callback will be invoked after all uploaded files are saved.
    busboy.on('finish', () => {
      const bucket = gcs.bucket('pwa-max-6421b.appspot.com')
      bucket.upload(
        upload.file,
        {
          uploadType: 'media',
          metadata: {
            metadata: {
              contentType: upload.type,
              firebaseStorageDownloadTokens: uuid
            }
          }
        },
        (err, uploadedFile) => {
          if (!err) {
            admin
              .database()
              .ref('posts')
              .push({
                id: fields.id,
                title: fields.title,
                location: fields.location,
                rawLocation: {
                  lat: fields.rawLocationLat,
                  lng: fields.rawLocationLng
                },
                image:
                  'https://firebasestorage.googleapis.com/v0/b/' +
                  bucket.name +
                  '/o/' +
                  encodeURIComponent(uploadedFile.name) +
                  '?alt=media&token=' +
                  uuid
              })
              .then(() => {
                webpush.setVapidDetails(
                  'mailto:jkerr013@gmail.com',
                  'BEtJhcxi7UZqEjomaCxkhx9Gan02YmazKB-aKGj4iXA_GWilM-hbLYopldTYxHJN-K2qMnPezXQuGC1XjcLFlIk',
                  'GRtx_h2mT76ygPgb2SAEF2uUzHE4H3rSKSQClIXSGmA'
                )
                return admin
                  .database()
                  .ref('subscriptions')
                  .once('value')
              })
              .then((subscriptions) => {
                subscriptions.forEach((sub) => {
                  const pushConfig = {
                    endpoint: sub.val().endpoint,
                    keys: {
                      auth: sub.val().keys.auth,
                      p256dh: sub.val().keys.p256dh
                    }
                  }
                  webpush
                    .sendNotification(
                      pushConfig,
                      JSON.stringify({
                        title: 'New Post',
                        content: 'New Post added!',
                        openUrl: '/'
                      })
                    )
                    .catch(err => {
                      console.log(err)
                    })
                })
                response
                  .status(201)
                  .json({ message: 'Data stored', id: fields.id })
              })
              .catch(err => {
                response.status(500).json({ error: err })
              })
          } else {
            console.log(err)
          }
        }
      )
    })
    busboy.end(request.rawBody)
  })
})
