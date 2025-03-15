// An Image plugin presents a picture with a caption. The image source
// can be any URL. Historically we used "data urls", to get the proper
// sharing semantics, now we use error handling on image load to try
// the places we might expect the image to be in turn.

import md5 from './md5'
import exifr from 'exifr'

const emit = ($item, item) => {
  const alternates = $item => {
    const sites = []
    const remote = $item.parents('.page').data('site')
    if (remote !== location.host) {
      sites.push(remote)
    }
    const journal = $item.parents('.page').data('data').journal
    for (const action of journal.slice(0).reverse()) {
      if (action.site && !sites.includes(action.site)) {
        sites.push(action.site)
      }
      if (action.attribution?.site && !sites.includes(action.attribution.site)) {
        sites.push(action.attribution.site)
      }
    }
    return sites.map(site => wiki.site(site).getURL(item.url.replace(/^\//, '')))
  }

  item.text ||= item.caption
  $item.addClass(item.size || 'thumbnail')
  $item.append(`<img class="${item.size || 'thumbnail'}" src="${item.url}"> <p>${wiki.resolveLinks(item.text)}</p>`)
  const img = $item.children('img').first()
  if (item.width) img.attr('width', item.width)
  if (item.height) img.attr('height', item.height)
  img.data('sites', alternates($item))

  img.on('error', function () {
    const sites = $(this).data('sites')
    const site = sites.shift()
    $(this).data('sites', sites)
    $(this).attr('src', site)
    if (sites.length === 0) {
      $(this).off('error')
    }
  })

  if (item.location?.latitude && item.location?.longitude) {
    $item.addClass('marker-source')
    $item.get(0).markerData = () => ({
      lat: item.location.latitude,
      lon: item.location.longitude,
      label: wiki.resolveLinks(item.text),
    })
  }

  if (isOwner) {
    img.on('load', function () {
      if ($(this).attr('src') !== item.url) {
        const imgHost = new URL($(this)[0].src).hostname
        const flagURL = wiki.site(imgHost).flag()
        const overlay = document.createElement('a')
        overlay.setAttribute('href', '#')
        overlay.setAttribute('title', 'fork this image')
        overlay.setAttribute('class', overlay)
        const flag = document.createElement('img')
        flag.setAttribute('src', flagURL)
        flag.setAttribute('class', 'overlay')
        overlay.append(flag)

        if ($(this)[0].nextSibling) {
          $(this)[0].parentNode.insertBefore(overlay, $(this)[0].nextSibling)
        } else {
          $(this)[0].parentNode.appendChild(overlay)
        }

        $(flag).on('click', e => {
          e.preventDefault()
          const imageNode = e.target.parentNode.previousSibling
          const archiveFilename = new URL(imageNode.src).pathname.split('/').pop()

          fetch(imageNode.src)
            .then(response => response.blob())
            .then(blob => {
              const file = new File([blob], archiveFilename, { type: blob.type })
              const form = new FormData()
              form.append('image', file, file.name)
              return fetch(`/plugins/image/upload/${archiveFilename}`, {
                method: 'POST',
                body: form,
              })
            })
            .then(response => {
              if (response.ok) {
                $(flag).off('click')
                overlay.parentNode.removeChild(overlay)
              }
            })
            .catch(err => {
              console.log('image fork failed', err)
            })
        })
      } else {
        if (!item.url.startsWith('/assets/plugins/image')) {
          const overlay = document.createElement('a')
          overlay.setAttribute('href', '#')
          overlay.setAttribute('title', 'import this image')
          overlay.setAttribute('class', 'overlay')
          const flag = document.createElement('img')
          flag.setAttribute('src', '/plugins/image/import.svg')
          flag.setAttribute('class', 'overlay')
          overlay.append(flag)
          if ($(this)[0].nextSibling) {
            $(this)[0].parentNode.insertBefore(overlay, $(this)[0].nextSibling)
          } else {
            $(this)[0].parentNode.appendChild(overlay)
          }
          $(flag).on('click', e => {
            e.preventDefault()
            const imageSource = e.target.parentNode.previousSibling.src
            fetch(imageSource)
              .then(response => {
                if (response.ok) {
                  return response.blob()
                }
              })
              .then(imageBlob => {
                const reader = new FileReader()
                reader.readAsDataURL(imageBlob)
                reader.onload = async loadEvent => {
                  const imageDataURL = loadEvent.target.result
                  const archiveImage = await resizeImage(imageDataURL, 'archive')
                  const archiveFilename = md5(imageDataURL) + '.jpg'
                  fetch(archiveImage)
                    .then(response => response.blob())
                    .then(blob => {
                      const file = new File([blob], archiveFilename, { type: blob.type })
                      const form = new FormData()
                      form.append('image', file, file.name)
                      return fetch(`/plugins/image/upload/${archiveFilename}`, { method: 'POST', body: form })
                    })
                    .then(response => {
                      if (response.ok) {
                        item.url = '/assets/plugins/image/' + archiveFilename
                        // image has now been saved locally, so update page item
                        const $page = $item.parents('.page:first')
                        // remove click handler and overlay
                        $(flag).off('click')
                        overlay.parentNode.removeChild(overlay)
                        // update height and width, old items likely don't have there
                        item.width = $item.children('img')[0].width
                        item.height = $item.children('img')[0].height
                        wiki.pageHandler.put($page, {
                          type: 'edit',
                          id: item.id,
                          item: item,
                        })
                      }
                    })
                    .catch(err => {
                      console.log('image import failed', err)
                    })
                }
              })
          })
        }
      }
    })
  }
}

const bind = ($item, item) => {
  // This only really works once the images have been rendered, so we know where we are...
  if ($item.hasClass('thumbnail')) {
    if ($item.offset().left - $item.parent().offset().left < 200) {
      $item.addClass('left')
    }
  }

  $item.on('dblclick', () => {
    editor({ $item, item })
  })

  $item.find('img').on('dblclick', event => {
    event.stopPropagation()
    const url = item.source ?? $item.children('img').first().attr('src')
    const dialogTitle = (item.text || '')
      .replace(/\[\[([^\]]+)\]\]/gi, '')
      .replace(/\[((http|https|ftp):.*?) (.*?)\]/gi, '')
      .replace(/<.*?>/gi, '')
    wiki.dialog(dialogTitle, `<img style="width:100%;" src="${url}">`)
  })
}

const editor = async spec => {
  const escape = string => {
    return string.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  const imageSize = async dataURL => {
    const img = new Image()
    img.src = dataURL
    await img.decode()
    return img.width > 415 ? 'wide' : 'thumbnail'
  }

  const { $item, item } = spec

  if (!$('.editEnable').is(':visible')) return

  // if new image is being added we have some extra information
  let newImage = false
  let imageDataURL, imageSourceURL, imageCaption

  if (item.type === 'factory') {
    ;({ imageDataURL, imageSourceURL, imageCaption } = spec)
    document.documentElement.style.cursor = 'default'
    item.type = 'image'
    $item.removeClass('factory').addClass('image')
    $item.off()
    newImage = true
    item.source = imageSourceURL
  } else {
    newImage = false
  }

  const keydownHandler = e => {
    // esc, or ctrl-s, or meta-s for save
    if (e.which === 27 || ((e.ctrlKey || e.metaKey) && e.which === 83)) {
      e.preventDefault()
      $item.trigger('focusout')
      return false
    }
    // ctrl-i, or meta-i, for information
    if ((e.ctrlKey || e.metaKey) && e.which === 73) {
      e.preventDefault()
      const page = e.shiftKey ? undefined : $(e.target).parents('.page')
      wiki.doInternalLink('about image plugin', page)
      return false
    }
  }

  const focusoutHandler = async event => {
    const editorDiv = document.querySelector('.imageEditing')
    if (editorDiv.contains(event.relatedTarget)) return
    const $page = $item.parents('.page:first')
    $item.removeClass('imageEditing')
    $item.off()
    if ($item.find('textarea').val().length > 0) {
      const captionChanged = item.text !== $item.find('textarea').val()
      const locationChanged =
        item.location?.latitude !== $item.find('#location-lat').val() ||
        item.location?.longitude !== $item.find('#location-lon').val()
      const sizeChanged =
        item.size && $item.find('#size-select').val() && item.size !== $item.find('#size-select').val()
      item.text = $item.find('textarea').val()
      item.size = $item.find('#size-select').val() ?? 'thumbnail'
      if (newImage || sizeChanged) {
        item.width = $item.children('img')[0].width
        item.height = $item.children('img')[0].height
      }
      if ($item.find('#location-lat').val() && $item.find('#location-lon').val()) {
        item.location = {
          latitude: $item.find('#location-lat').val(),
          longitude: $item.find('#location-lon').val(),
        }
      } else {
        delete item.location
        $item.removeClass('marker-source')
      }
      // only save if newImage , caption, location, or size has been changed.
      if (newImage || captionChanged || locationChanged || sizeChanged) {
        if (newImage) {
          const archiveImage = await resizeImage(imageDataURL, 'archive')
          const archiveFilename = md5(imageDataURL) + '.jpg'
          await fetch(archiveImage)
            .then(response => response.blob())
            .then(blob => {
              const file = new File([blob], archiveFilename, { type: blob.type })
              const form = new FormData()
              form.append('image', file, file.name)
              return fetch(`/plugins/image/upload/${archiveFilename}`, {
                method: 'POST',
                body: form,
              })
            })
            .then(response => {
              if (response.ok) {
                item.url = `/assets/plugins/image/${archiveFilename}`
              }
            })
            .catch(err => console.log('image upload failed', err))
        }

        wiki.doPlugin($item.empty(), item)
        if (item !== original) {
          delete item.caption
          wiki.pageHandler.put($page, { type: 'edit', id: item.id, item: item })
        } else {
          const index = $('.item').index($item)
          wiki.renderFrom(index)
        }
      } else {
        wiki.pageHandler.put($page, { type: 'remove', id: item.id })
        const index = $('.item').index($item)
        $item.remove()
        wiki.renderFrom(index)
      }
      return null
    }
  }
  if ($item.hasClass('imageEditing')) return
  $item.addClass('imageEditing')
  $item.off()
  const original = JSON.parse(JSON.stringify(item))

  let imgPossibleSize, imgURL

  if (newImage) {
    const imageLocation = await exifr.gps(imageDataURL)
    if (imageLocation) {
      item.location = imageLocation
    }
    imgPossibleSize = await imageSize(imageDataURL)
    imgURL = imageDataURL
  } else {
    imgPossibleSize = $item.children('img').first()[0].naturalWidth > 415 ? 'wide' : 'thumbnail'
    imgURL = $item.children('img').first().attr('src')
    imageCaption = item.text ||= item.caption
  }

  const imgCurrentSize = item.size ?? (newImage ? imgPossibleSize : 'thumbnail')
  $item.addClass(imgCurrentSize)

  const $imageEditor = $(`
    <img class="${imgCurrentSize}" src="${imgURL}">
    <textarea>${escape(imageCaption)}</textarea>
    `)
  $item.html($imageEditor)

  $item.append(`<div id="image-options"></div>`)

  $('#image-options').append(`
    <details ${item.location ? 'open' : ''}>
      <summary>Location:</summary>
      <input type='text' id='location-lat' value='${item.location?.latitude || ''}' placeholder='Latitude'>
      <input type='text' id='location-lon' value='${item.location?.longitude || ''}' placeholder='Longitude'>
    </details>
    `)

  const pasteLocation = event => {
    event.preventDefault()
    const separator = /[,/]/
    const pasted = (event.originalEvent.clipboardData ?? window.clipboardData).getData('text')
    if (separator.test(pasted)) {
      const [pasteLat, pasteLon] = pasted.split(separator).map(i => i.trim())
      if (!(isNaN(pasteLat) || isNaN(pasteLon))) {
        item.location = { latitude: pasteLat, longitude: pasteLon }
        $item.find('#location-lat').val(pasteLat)
        $item.find('#location-lon').val(pasteLon)
      }
    }
  }

  $('#location-lat').on('paste', pasteLocation)
  $('#location-lon').on('paste', pasteLocation)

  if (imgPossibleSize == 'wide') {
    $('#image-options').append(`
      <div>
        <label>Image Size:</label>
        <select id="size-select">
          <option value="" disabled>--Please choose a size--</option>
          <option value="thumbnail">Half page width</option>
          <option value="wide">Full page width</option>
        </select>
      </div>
      `)

    $item.find(`#size-select option[value="${imgCurrentSize}"]`).attr('selected', true)

    $('#size-select').on('change', event => {
      $item.removeClass('thumbnail wide')
      $item.addClass(event.target.value)
      $item.find('img').removeClass('thumbnail wide').addClass(event.target.value)
    })
  }

  $item.on('focusout', focusoutHandler).on('keydown', keydownHandler)

  $imageEditor.trigger('focus')
}

const resizeImage = async dataURL => {
  const tW = 1920
  const tH = 1080
  const imageQuality = 0.5

  const smallEnough = img => img.width <= tW && img.height <= tH

  const src = new Image()
  src.src = dataURL
  await new Promise(resolve => (src.onload = resolve))

  let cW = src.naturalWidth
  let cH = src.naturalHeight

  if (smallEnough(src)) return dataURL

  const oversize = Math.max(1, cW / tW, cH / tH)
  const iterations = Math.floor(Math.log2(oversize))
  const prescale = oversize / 2 ** iterations

  cW = Math.round(cW / prescale)
  cH = Math.round(cH / prescale)

  return new Promise(resolve => {
    const tmp = new Image()
    tmp.src = src.src
    tmp.onload = () => {
      if (smallEnough(tmp)) {
        resolve(dataURL)
      } else {
        const canvas = document.createElement('canvas')
        canvas.width = cW
        canvas.height = cH
        const context = canvas.getContext('2d')
        context.drawImage(tmp, 0, 0, cW, cH)
        const newDataURL = canvas.toDataURL('image/jpg', imageQuality)
        cW /= 2
        cH /= 2
        resolve(newDataURL)
      }
    }
  })
}

if (typeof window !== 'undefined') {
  window.plugins.image = { emit, bind, editor }
}

export const image = typeof window == 'undefined' ? { emit, bind, editor } : undefined
