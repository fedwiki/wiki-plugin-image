# An Image plugin presents a picture with a caption. The image source
# can be any URL but we have been using "data urls" so as to get the
# proper sharing semantics if not storage efficency.


md5 = require './md5'
exifr = require('exifr') 


emit = ($item, item) ->

  alternates = ($item) ->
    sites = []
    if remote = $item.parents('.page').data('site')
      unless remote == location.host
        sites.push remote
    journal = $item.parents('.page').data('data').journal
    for action in journal.slice(0).reverse()
      if action.site? and not sites.includes(action.site)
        sites.push action.site
      if action.attribution?.site? and not sites.includes(action.attribution.site)
        sites.push action.attribution.site
    sites.map( (site) -> wiki.site(site).getURL(item.url.replace(/^\//, '')))

  item.text ||= item.caption
  $item.addClass(item.size or 'thumbnail')
  $item.append "<img class='#{item.size or 'thumbnail'}' src='#{item.url}'> <p>#{wiki.resolveLinks(item.text)}</p>"
  img = $item.children('img').first()
  img.attr('width', item.width) if item.width
  img.attr('height', item.height) if item.height
  img.data('sites', alternates($item))
  img.on('error', () ->
    sites = $( this ).data('sites')
    site = sites.shift()
    $( this ).data('sites', sites)
    $( this ).attr('src', site )
    if sites.length is 0
      $( this ).off('error')
    )
  if item.location?.latitude and item.location?.longitude
    $item.addClass 'marker-source'
    $item.get(0).markerData = ->
      return { 
        lat: item.location.latitude
        lon: item.location.longitude
        label: wiki.resolveLinks(item.text)
        }
  if isOwner
    img.on('load', () ->
      if $( this ).attr('src') isnt item.url
        imgHost = new URL($( this )[0].src).hostname
        flagURL = wiki.site(imgHost).flag()
        overlay = document.createElement('a')
        overlay.setAttribute('href', '#')
        overlay.setAttribute('title', 'fork this image')
        overlay.setAttribute('class', 'overlay')
        flag = document.createElement('img')
        flag.setAttribute('src', flagURL)
        flag.setAttribute('class', 'overlay')
        overlay.append(flag)
        if $( this )[0].nextSibling
          $( this )[0].parentNode.insertBefore(overlay, $( this )[0].nextSibling)
        else
          $( this )[0].parentNode.appendChild(overlay)
        $( flag ).on('click', (e) ->
          e.preventDefault()
          imageNode = e.target.parentNode.previousSibling
          archiveFilename = new URL(imageNode.src).pathname.split('/').pop()
          await fetch(imageNode.src)
          .then (response) ->
            response.blob()
          .then (blob) ->
            file = new File(
              [blob],
              archiveFilename,
              { type: blob.type }
            )
            form = new FormData()
            form.append 'image', file, file.name
            fetch("/plugin/image/upload/#{archiveFilename}", {
              method: 'POST',
              body: form
            })
            .then (response) ->
              if response.ok
                $( flag ).off('click')
                overlay.parentNode.removeChild(overlay)
            .catch (err) ->
              console.log('image archive failed (save)', err)
          .catch (err) ->
            console.log('image archive failed', err)
        )
      )

bind = ($item, item) ->
  # This only really works once the images have been rendered, so we know where we are...
  if $item.hasClass('thumbnail')
    if $item.offset().left - $item.parent().offset().left < 200
      $item.addClass('left') 

  $item.dblclick ->
    editor({ $item, item })


  $item.find('img').dblclick (event) ->
    event.stopPropagation()
    url = if item.source?
      # somehow test for continued existnace? Maybe register an error handler?
      item.source
    else
      $item.children('img').first().attr('src')
    dialogTitle = (item.text||'').replace /\[\[([^\]]+)\]\]/gi, ''
      .replace /\[((http|https|ftp):.*?) (.*?)\]/gi, ''
      .replace /\<.*?\>/gi, ''
    wiki.dialog dialogTitle, """<img style="width:100%" src="#{url}">"""

editor = (spec) ->

  escape = (string) ->
    string
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  imageSize = (dataURL) ->
    img = new Image()
    img.src = dataURL
    img.decode()
      .then () ->
        if img.width > 415
          return "wide"
        else
          return "thumbnail"

  { $item, item } = spec
  return unless $('.editEnable').is(':visible')
  
  # if new image is being added we have some extra information
  { imageDataURL, filename, imageSourceURL, imageCaption } = spec if item.type is 'factory'
  if item.type is 'factory'
    document.documentElement.style.cursor = 'default'
    $item.removeClass('factory').addClass(item.type = 'image')
    $item.unbind()
    newImage = true
    item.source = imageSourceURL
  else
    newImage = false

  keydownHandler = (e) ->

    if e.which is 27 # esc for save
      e.preventDefault()
      $item.focusout()
      return false

    if (e.ctrlKey or e.metaKey) and e.which is 83 # ctrl-s for save
      e.preventDefault()
      $item.focusout()
      return false
    
    if (e.ctrlKey or e.metaKey) and e.which is 73 # ctrl-i for information
      e.preventDefault()
      page = $(e.target).parents('.page') unless e.shiftKey
      wiki.doInternalLink "about image plugin", page
      return false

    # lets not support ctrl-m, at least for now

  focusoutHandler = (event) ->
    # need to test if focus is still within the imageEditor div
    # $item.removeClass 'imageEditing'
    editorDiv = document.querySelector('.imageEditing')
    if editorDiv.contains(event.relatedTarget)
      return
    
    $page = $item.parents('.page:first')
    # if newImage
    #   item.url = await resizeImage imageDataURL
    $item.removeClass 'imageEditing'
    $item.unbind()
    if $item.find('textarea').val().length > 0

      captionChanged = item.text != $item.find('textarea').val()
      locationChanged = item.location? and ( item.location.latitude != $item.find('#location-lat').val() or item.location.longitude != $item.find('#location-lon').val() ) 
      sizeChanged = item.size? and $item.find('#size-select').val()? and item.size != $item.find('#size-select').val()

      item.text = $item.find('textarea').val()
      item.size = $item.find('#size-select').val() ? 'thumbnail'
      if newImage or sizeChanged
        item.width = $item.children('img')[0].width
        item.height = $item.children('img')[0].height
      if $item.find('#location-lat').val() and $item.find('#location-lon').val()
        item.location = { latitude: $item.find('#location-lat').val(), longitude: $item.find('#location-lon').val() }
      else
        delete item.location
        $item.removeClass 'marker-source'

      # only save if newImage , caption, location, or size has been changed.
      if newImage or captionChanged or locationChanged or sizeChanged
        if newImage
          # archive image
          archiveImage = await resizeImage(imageDataURL, 'archive')
          archiveFilename = md5(imageDataURL) + '.jpg'
          await fetch(archiveImage)
          .then (response) ->
            response.blob()
          .then (blob) ->
            file = new File(
              [blob],
              archiveFilename,
              { type: blob.type }
            )
            form = new FormData()
            form.append 'image', file, file.name
            fetch("/plugin/image/upload/#{archiveFilename}", {
              method: 'POST',
              body: form
            })
            .then (response) ->
              if response.ok
                item.url = "/assets/plugins/image/" + archiveFilename
            .catch (err) ->
              console.log('image archive failed (save)', err)
          .catch (err) ->
            console.log('image archive failed', err)
      
        wiki.doPlugin $item.empty(), item
        return if item is original
        if item.hasOwnProperty('caption')
          delete item.caption 
        wiki.pageHandler.put $page, { type: 'edit', id: item.id, item: item }
      else
        index = $(".item").index($item)
        wiki.renderFrom index

    else
      wiki.pageHandler.put $page, { type: 'remove', id: item.id }
      index = $(".item").index($item)
      $item.remove()
      wiki.renderFrom index
    null


  return if $item.hasClass 'imageEditing'
  $item.addClass 'imageEditing'
  $item.unbind()
  original = JSON.parse(JSON.stringify(item))
  if newImage
    imageLocation = await exifr.gps(imageDataURL)
    if imageLocation
      exifrAvailable = true
      item.location = imageLocation
    imgPossibleSize = await imageSize(imageDataURL)
    imgURL = imageDataURL
  else
    imgPossibleSize = if $item.children('img').first()[0].naturalWidth > 415 then 'wide' else 'thumbnail'
    imgURL = $item.children('img').first().attr('src')
    imageCaption = item.text ||= item.caption
  
  if item.size
    imgCurrentSize = item.size
  else
    if newImage
      imgCurrentSize = imgPossibleSize
    else
      imgCurrentSize = "thumbnail"
  $item.addClass(imgCurrentSize)

  $imageEditor = $ """
    <img class='#{imgCurrentSize}' src='#{imgURL}'>
    <textarea>#{escape imageCaption}</textarea>
    """
  
  $item.html $imageEditor

  $item.append """<div id="image-options"></div>"""

  $('#image-options').append """
    <details #{if item.location then 'open' else ''}>
    <summary>Location:</summary>
    <input type='text' id='location-lat' value='#{item.location?.latitude or ''}' placeholder='Latitude'>
    <input type='text' id='location-lon' value='#{item.location?.longitude or ''}' placeholder='Longitude'>
  </details>
  """

  pasteLocation = (event) ->
    event.preventDefault()
    separator = /[,\/]/
    pasted = (event.originalEvent.clipboardData or window.clipboardData).getData('text')
    if separator.test(pasted)
      [pasteLat, pasteLon] = pasted.split(separator).map (i) => i.trim()
      if !(isNaN(pasteLat) or isNaN(pasteLon))
        item.location = { latitude: pasteLat, longitude: pasteLon }
        $item.find('#location-lat').val(pasteLat)
        $item.find('#location-lon').val(pasteLon)
  
  $('#location-lat').on('paste', pasteLocation);
  $('#location-lon').on('paste', pasteLocation);

  if imgPossibleSize is "wide"
    $('#image-options').append """
    <div>
      <label>Image Size:</label>
      <select id="size-select">
        <option value="" disabled>--Please choose a size--</option>
        <option value="thumbnail">Half page width</option>
        <option value="wide">Full page width</option>
      </select>
    </div>
    """

    $item.find("#size-select option[value='#{imgCurrentSize}']").attr('selected', true)
    
    $('#size-select').change( () ->
      $item.removeClass("thumbnail wide")
      $item.addClass($(this).val())
      $item.find('img').removeClass("thumbnail wide")
        .addClass($(this).val())
      
      )


  $item.focusout focusoutHandler
    .bind 'keydown', keydownHandler  

  $imageEditor.focus()
  
  # from https://web.archive.org/web/20140327091827/http://www.benknowscode.com/2014/01/resizing-images-in-browser-using-canvas.html
  # Patrick Oswald version from comment, coffeescript and further simplification for wiki

  resizeImage = (dataURL) ->
    src = new Image
    cW = undefined
    cH = undefined
    # target sizes

    tW = 1920
    tH = 1080
    
    # image quality
    imageQuality = 0.5

    smallEnough = (img) ->
      img.width <= tW and img.height <= tH

    new Promise (resolve) ->
      src.src = dataURL
      src.onload = ->
        resolve()
    .then () ->
      cW = src.naturalWidth
      cH = src.naturalHeight
    .then () ->
      # determine size for first squeeze
      return if smallEnough src

      oversize = Math.max 1, cW/tW, cH/tH
      iterations = Math.floor Math.log2 oversize
      prescale = oversize / 2**iterations

      cW = Math.round(cW / prescale)
      cH = Math.round(cH / prescale)

    .then () ->
      new Promise (resolve) ->
        tmp = new Image
        tmp.src = src.src
        tmp.onload = ->
          if smallEnough tmp
            return resolve dataURL  
          canvas = document.createElement('canvas')
          canvas.width = cW
          canvas.height = cH
          context = canvas.getContext('2d')
          context.drawImage tmp, 0, 0, cW, cH
          dataURL = canvas.toDataURL('image/jpeg', imageQuality)
          cW /= 2
          cH /= 2
          tmp.src = dataURL
    .then ->
      return dataURL



window.plugins.image = { emit, bind, editor } if window?
module.exports = {emit, bind, editor}
