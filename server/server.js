
const fs = require('fs')
const path = require('path')
const multer = require('multer')

startServer = (params) => {
  const { app, argv } = params

  const upload = multer({ dest: path.join(argv.commons, 'uploads')})

  // check commons folder exists
  fs.stat(argv.commons, (err, stats) => {
    if (err) {
      fs.mkdir(argv.commons, {recursive: true}, (err) => {
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
      fs.mkdir(path.join(argv.assets, 'plugins', 'image'), {recursive: true}, (err) => {
        if (err) {
          console.error(`*** Image - unable to create directory ${path.join(argv.assets, 'plugins', 'image')} \n\t ${err}`)
        }
      })
    } else {
      if (!stats.isDirectory()) {
        console.error(`*** Image - ${path.join(argv.assets, 'plugins', 'images')} is not a directory`)
      }
    }
  })

  authorized = (req, res, next) => {
    if (app['securityhandler'].isAuthorized(req)) {
      next()
    } else {
      res.status(403).send('must be owner')
    }
  }

  app.post(/^\/plugin\/image\/upload\/([a-f0-9]{32}\.\w+)$/, authorized, upload.single('image'), function(req, res) {
    console.log('image - upload', req.params[0])
    imageFile = req.params[0]
    commonsFile = path.join(argv.commons, imageFile)
    assetFile = path.join(argv.assets, 'plugins', 'image', imageFile)

    uploadFile = req.file.path


    fs.stat(commonsFile, (err, stats) => {
      if (err) {
        fs.rename(uploadFile, commonsFile, (err) => {
          if (err) {
            console.log(`*** Image - rename of upload file fails, ${uploadFile} -> ${commonsFile} : ${err}`)
            return res.status(500).send(`Failed saving image to commons: ${error}`)
          }
          fs.link(commonsFile, assetFile, (err) => {
            if (err) {
              console.log(`*** Image - failed to link to commons : ${commonFile} -> ${assetFile} : ${err}`)
              return res.status(500).send(`Failed to link to commons: ${assetFile}`)
            }
            return res.end('success')
          })
        })
      } else {
        fs.unlink(uploadFile, (err) => {
          if (err) {
            console.log(`*** Image - failed to remove upload file, ${uploadFile} : ${error}`)
          }
          fs.stat(assetFile, (err, stats) => {
            if (err) {
              fs.link(commonsFile, assetFile, (err) => {
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

  app.get(/^\/plugin\/image\/gallery.html/, function(req, res){
    console.log('image - gallery')
    console.log('gallery - path', argv, __dirname)
    gallery = ""
    imageDir = path.join(argv.assets, 'plugins', 'image')
    fs.readdir(imageDir, {withFileTypes: true}, (err, files) => {
      files.forEach(file => {
        if (file.isFile() && !file.name.startsWith('.')) {
          stats = fs.statSync(path.join(imageDir, file.name))
          alt = `Filename : ${file.name}`
          alt += `\nSize\t: ${(stats.size / 1024).toFixed(2)} kB`
          alt += `\nAdded\t: ${stats.birthtime}`
          switch (stats.nlink) {
            case 1:
              alt += '\nImage is not in commons'
              break;
            case 2:
              alt += '\nNot used elsewhere in this farm'
              break;
            default:
              alt += `\nUsed in ${stats.nlink - 2} other wiki in this farm`
          }
            
          gallery += `
          <div>
            <img src="/assets/plugins/image/${file.name}" title="${alt}" />
          </div>
          `
        }
      })
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Image Gallery</title>
            <link id='favicon' href='/favicon.png' rel='icon' type='image/png'>
            <link href='/plugins/image/gallery.css' rel='stylesheet' type='text/css'>
            <script type='module' src='/plugins/image/gallery.js' ></script>
          </head>
          <body>
            <div class="gallery" id="gallery">
              ${gallery}
            </div>
          </body>
        </html>
      `)
    })
  })
}

module.exports = { startServer }