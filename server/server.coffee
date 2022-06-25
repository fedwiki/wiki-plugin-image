# assets plugin, server-side component
# These handlers are launched with the wiki server. 

fs = require 'fs'
{ basename } = require 'path'
mkdirp = require 'mkdirp'
formidable = require 'formidable'

cors = (req, res, next) ->
  res.header('Access-Control-Allow-Origin', '*')
  next()

startServer = (params) ->
  app = params.app
  argv = params.argv

  app.post '/plugin/image/upload', (req, res) ->
    return res.status(401).send("must login") unless req.session?.passport?.user || req.session?.email || req.session?.friend
    return res.status(401).send("must be owner") unless app.securityhandler.isAuthorized(req)
    form = new (formidable.IncomingForm)
    form.multiples = true
    form.uploadDir = "#{argv.assets}"
    mkdirp.sync form.uploadDir
    form.on 'field', (name, value) ->
      return unless name == 'assets'
      assets = (value||'').match(/([\w\/-]*)/)[1]
      form.uploadDir = "#{argv.assets}/#{assets}"
      mkdirp.sync form.uploadDir
    form.on 'file', (field, file) ->
      fs.rename file.path, "#{form.uploadDir}/#{file.name}", (err) ->
        return res.status(500).send("rename error: #{err}") if err
    form.on 'error', (err) ->
      console.log "upload error: #{err}"
      res.status(500).send("upload error: #{err}")
    form.on 'end', ->
      res.end 'success'
    form.parse req

module.exports = {startServer}
