import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'

const startServer = params => {
  const { app, argv } = params

  const upload = multer({ dest: path.join(argv.commons, 'uploads') })

  // check commons folder exists
  fs.stat(argv.commons, (err, stats) => {
    if (err) {
      fs.mkdir(argv.commons, { recursive: true }, err => {
        if (err) {
          console.error(`*** Image - unable to create directory ${argv.commons} \n\t ${err}`)
        }
      })
    } else {
      if (!stats.isDirectory()) {
        console.error(`*** Image - ${argv.commons} is not a directory`)
      }
    }
  })

  // check image asset folder exists
  fs.stat(path.join(argv.assets, 'plugins', 'image'), (err, stats) => {
    if (err) {
      fs.mkdir(path.join(argv.assets, 'plugins', 'image'), { recursive: true }, err => {
        if (err) {
          console.error(
            `*** Image - unable to create directory ${path.join(argv.assets, 'plugins', 'image')} \n\t ${err}`,
          )
        }
      })
    } else {
      if (!stats.isDirectory()) {
        console.error(`*** Image - ${path.join(argv.assets, 'plugins', 'images')} is not a directory`)
      }
    }
  })

  const authorized = (req, res, next) => {
    if (app['securityhandler'].isAuthorized(req)) {
      next()
    } else {
      res.status(403).send('must be owner')
    }
  }

  app.post(/^\/plugins\/image\/upload\/([a-f0-9]{32}\.\w+)$/, authorized, upload.single('image'), function (req, res) {
    console.log('image - upload', req.params[0])
    const imageFile = req.params[0]
    const commonsFile = path.join(argv.commons, imageFile)
    const assetFile = path.join(argv.assets, 'plugins', 'image', imageFile)

    const uploadFile = req.file.path

    fs.stat(commonsFile, (err, stats) => {
      if (err) {
        fs.rename(uploadFile, commonsFile, err => {
          if (err) {
            console.log(`*** Image - rename of upload file fails, ${uploadFile} -> ${commonsFile} : ${err}`)
            return res.status(500).send(`Failed saving image to commons: ${err}`)
          }
          fs.link(commonsFile, assetFile, err => {
            if (err) {
              console.log(`*** Image - failed to link to commons : ${commonsFile} -> ${assetFile} : ${err}`)
              return res.status(500).send(`Failed to link to commons: ${assetFile}`)
            }
            return res.end('success')
          })
        })
      } else {
        fs.unlink(uploadFile, err => {
          if (err) {
            console.log(`*** Image - failed to remove upload file, ${uploadFile} : ${err}`)
          }
          fs.stat(assetFile, (err, stats) => {
            if (err) {
              fs.link(commonsFile, assetFile, err => {
                if (err) {
                  console.log(`*** Image - failed to link to commons : ${commonsFile} -> ${assetFile} : ${err}`)
                  return res.status(500).send(`Failed to link to commons: ${assetFile}`)
                }
                return res.end('success')
              })
            } else {
              return res.end('success')
            }
          })
        })
      }
    })
  })
}

export { startServer }
