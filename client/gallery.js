window.addEventListener('load', () => {
  document.querySelectorAll('img').forEach((img) => {
    const ratio = img.naturalWidth / img.naturalHeight
    console.log(img, ratio, img.naturalWidth, img.naturalHeight)
    let divClass = null
    if (img.naturalWidth <= 200 || img.naturalHeight <= 200) {
      divClass = 'small'
    } else if (ratio >= 2 && ratio < 3 ) {
      divClass = 'wide'
    } else if (ratio >= 3) {
      divClass = 'very-wide'
    } else if (ratio <= 0.75) {
      divClass = 'tall'
    } else if (img.naturalWidth >= 1024 && img.naturalHeight >= 1024) {
      divClass = 'big'
    }
    if (divClass) {
      img.closest('div').classList.add(divClass)
    }
    img.addEventListener('click', () => {
      img.classList.toggle('full')
    })
  })
})